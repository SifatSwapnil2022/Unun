import { describe, expect, it } from 'vitest';
import {
  EMPTY_BAG,
  MAX_QUANTITY,
  addItem,
  itemCount,
  parseBag,
  quantityOf,
  setQuantity,
  type BagItem,
  type BagKitchen,
} from './bag';

const dumGhor: BagKitchen = { slug: 'dum-ghor', name: { en: 'Dum Ghor', bn: 'দম ঘর' } };
const shorisha: BagKitchen = { slug: 'shorisha', name: { en: 'Shorisha', bn: 'সরিষা' } };
const kacchi: BagItem = {
  itemId: 1,
  name: { en: 'Kacchi', bn: 'কাচ্চি' },
  unitPrice: 34000,
};
const borhani: BagItem = {
  itemId: 2,
  name: { en: 'Borhani', bn: 'বোরহানি' },
  unitPrice: 5500,
};

describe('addItem', () => {
  it('starts a bag for the kitchen', () => {
    const bag = addItem(EMPTY_BAG, dumGhor, kacchi);
    expect(bag?.kitchen).toEqual(dumGhor);
    expect(bag?.lines).toEqual([{ ...kacchi, quantity: 1 }]);
  });

  it('raises the quantity when the item is already in the bag', () => {
    const once = addItem(EMPTY_BAG, dumGhor, kacchi)!;
    const twice = addItem(once, dumGhor, kacchi)!;
    expect(quantityOf(twice, kacchi.itemId)).toBe(2);
    expect(twice.lines).toHaveLength(1);
  });

  it('refuses an item from another kitchen', () => {
    const bag = addItem(EMPTY_BAG, dumGhor, kacchi)!;
    expect(addItem(bag, shorisha, borhani)).toBeNull();
  });

  it('does not change the bag it was given', () => {
    const bag = addItem(EMPTY_BAG, dumGhor, kacchi)!;
    addItem(bag, dumGhor, borhani);
    expect(bag.lines).toHaveLength(1);
  });
});

describe('setQuantity', () => {
  const bag = addItem(addItem(EMPTY_BAG, dumGhor, kacchi)!, dumGhor, borhani)!;

  it('removes a line at zero', () => {
    const next = setQuantity(bag, kacchi.itemId, 0);
    expect(next.lines.map((line) => line.itemId)).toEqual([borhani.itemId]);
  });

  it('forgets the kitchen when the last line goes', () => {
    const next = setQuantity(setQuantity(bag, kacchi.itemId, 0), borhani.itemId, 0);
    expect(next).toEqual(EMPTY_BAG);
  });

  it('caps the quantity', () => {
    expect(quantityOf(setQuantity(bag, kacchi.itemId, 99), kacchi.itemId)).toBe(
      MAX_QUANTITY,
    );
  });
});

describe('itemCount', () => {
  it('adds up the quantities', () => {
    const bag = setQuantity(addItem(EMPTY_BAG, dumGhor, kacchi)!, kacchi.itemId, 3);
    expect(itemCount(addItem(bag, dumGhor, borhani)!)).toBe(4);
  });
});

describe('parseBag', () => {
  it('reads back a stored bag', () => {
    const bag = addItem(EMPTY_BAG, dumGhor, kacchi)!;
    expect(parseBag(JSON.stringify(bag))).toEqual(bag);
  });

  it('returns an empty bag for missing, broken or tampered data', () => {
    expect(parseBag(null)).toEqual(EMPTY_BAG);
    expect(parseBag('{not json')).toEqual(EMPTY_BAG);
    expect(parseBag('{"kitchen":null,"lines":[]}')).toEqual(EMPTY_BAG);
    expect(
      parseBag(
        JSON.stringify({ kitchen: dumGhor, lines: [{ ...kacchi, quantity: -4 }] }),
      ),
    ).toEqual(EMPTY_BAG);
  });
});
