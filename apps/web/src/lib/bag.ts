/**
 * The bag. It lives in the browser (localStorage) and holds items from one kitchen at a
 * time. Prices kept here are for display only: the server prices every order again.
 */
import type { Localized, Paisa } from '@unun/core';

export const MAX_QUANTITY = 20;

export type BagKitchen = {
  slug: string;
  name: Localized;
};

export type BagLine = {
  itemId: number;
  name: Localized;
  unitPrice: Paisa;
  quantity: number;
};

export type Bag = {
  kitchen: BagKitchen | null;
  lines: BagLine[];
};

export type BagItem = Omit<BagLine, 'quantity'>;

export const EMPTY_BAG: Bag = { kitchen: null, lines: [] };

/** Adds one of an item. Returns null if the bag belongs to another kitchen. */
export function addItem(bag: Bag, kitchen: BagKitchen, item: BagItem): Bag | null {
  if (bag.kitchen && bag.kitchen.slug !== kitchen.slug && bag.lines.length > 0)
    return null;

  const existing = bag.lines.find((line) => line.itemId === item.itemId);
  if (existing) return setQuantity(bag, item.itemId, existing.quantity + 1);

  return { kitchen, lines: [...bag.lines, { ...item, quantity: 1 }] };
}

/** Sets how many of an item are in the bag. Zero removes it; an empty bag forgets its kitchen. */
export function setQuantity(bag: Bag, itemId: number, quantity: number): Bag {
  const clamped = Math.max(0, Math.min(MAX_QUANTITY, Math.trunc(quantity)));
  const lines = bag.lines
    .map((line) => (line.itemId === itemId ? { ...line, quantity: clamped } : line))
    .filter((line) => line.quantity > 0);

  return lines.length === 0 ? EMPTY_BAG : { kitchen: bag.kitchen, lines };
}

export function itemCount(bag: Bag): number {
  return bag.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function quantityOf(bag: Bag, itemId: number): number {
  return bag.lines.find((line) => line.itemId === itemId)?.quantity ?? 0;
}

/** Reads a stored bag, discarding anything that is not shaped like one. */
export function parseBag(raw: string | null): Bag {
  if (!raw) return EMPTY_BAG;
  try {
    const value = JSON.parse(raw) as Partial<Bag> | null;
    const kitchen = value?.kitchen;
    if (!kitchen || typeof kitchen.slug !== 'string' || !Array.isArray(value.lines)) {
      return EMPTY_BAG;
    }

    const lines = value.lines.filter(
      (line): line is BagLine =>
        Number.isInteger(line?.itemId) &&
        Number.isInteger(line?.unitPrice) &&
        Number.isInteger(line?.quantity) &&
        line.quantity > 0 &&
        line.quantity <= MAX_QUANTITY &&
        typeof line?.name?.en === 'string' &&
        typeof line?.name?.bn === 'string',
    );
    return lines.length === 0 ? EMPTY_BAG : { kitchen, lines };
  } catch {
    return EMPTY_BAG;
  }
}
