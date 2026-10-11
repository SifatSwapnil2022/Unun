/**
 * Turns the seed definitions into rows. Everything here is deterministic: the same
 * definitions always produce the same menus, prices and coordinates.
 */
import { taka, type Paisa } from '@unun/core';
import { areaSeeds, type AreaSeed } from './areas';
import { dishSeeds, type DishSeed } from './dishes';
import type { KitchenSeed } from './kitchens';
import { menuTemplates } from './menus';

const dishesByKey = new Map(dishSeeds.map((dish) => [dish.key, dish]));
const areasById = new Map(areaSeeds.map((area) => [area.id, area]));

/** How likely a kitchen is to carry an optional dish, in percent. */
const OPTIONAL_SHARE = 62;

/** FNV-1a, a small stable string hash. */
export function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** Scales a base price and rounds it the way menus are priced: to 5 below ৳100, else to 10. */
export function scalePrice(baseTaka: number, level: number): Paisa {
  const raw = baseTaka * level;
  const step = raw < 100 ? 5 : 10;
  return taka(Math.max(Math.round(raw / step) * step, step * 2));
}

export function areaOf(kitchen: KitchenSeed): AreaSeed {
  const area = areasById.get(kitchen.area);
  if (!area) throw new Error(`${kitchen.slug}: unknown area "${kitchen.area}"`);
  return area;
}

/** Places a kitchen a few hundred metres from the centre of its area. */
export function locate(kitchen: KitchenSeed): { lat: number; lng: number } {
  const area = areaOf(kitchen);
  const spread = 0.012;
  const north = (hash(`${kitchen.slug}:lat`) % 1000) / 1000 - 0.5;
  const east = (hash(`${kitchen.slug}:lng`) % 1000) / 1000 - 0.5;
  return {
    lat: Number((area.lat + north * spread).toFixed(5)),
    lng: Number((area.lng + east * spread).toFixed(5)),
  };
}

export type BuiltItem = {
  dish: DishSeed;
  price: Paisa;
  popular: boolean;
};

export type BuiltSection = {
  en: string;
  bn: string;
  items: BuiltItem[];
};

export function buildMenu(kitchen: KitchenSeed): BuiltSection[] {
  const level = areaOf(kitchen).priceLevel;
  const signature = new Set(kitchen.signature);
  const sections: BuiltSection[] = [];

  for (const template of menuTemplates[kitchen.menu]) {
    const items: BuiltItem[] = [];

    for (const entry of template.dishes) {
      const optional = entry.startsWith('?');
      const key = optional ? entry.slice(1) : entry;
      const dish = dishesByKey.get(key);
      if (!dish) throw new Error(`${kitchen.slug}: unknown dish "${key}"`);

      const carried =
        !optional ||
        signature.has(key) ||
        hash(`${kitchen.slug}:${key}`) % 100 < OPTIONAL_SHARE;
      if (!carried) continue;

      items.push({
        dish,
        price: scalePrice(dish.price, level),
        popular: signature.has(key),
      });
    }

    if (items.length > 0) sections.push({ en: template.en, bn: template.bn, items });
  }

  return sections;
}
