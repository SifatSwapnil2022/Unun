import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALLERGENS, sortAllergens } from '@unun/core';
import { describe, expect, it } from 'vitest';
import { dishAllergens } from './allergens';
import { areaSeeds } from './areas';
import { buildMenu, scalePrice } from './build';
import { cuisineSeeds } from './cuisines';
import { dishSeeds } from './dishes';
import { kitchenSeeds } from './kitchens';
import { menuTemplates } from './menus';
import { goesWith } from './pairings';
import { promotionSeeds } from './promotions';

type Manifest = { photos: Array<{ key: string }> };

const manifest = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../media/manifest.json', import.meta.url)),
    'utf8',
  ),
) as Manifest;

const photoKeys = new Set(manifest.photos.map((photo) => photo.key));
const dishKeys = new Set(dishSeeds.map((dish) => dish.key));
const areaIds = new Set(areaSeeds.map((area) => area.id));
const cuisineIds = new Set(cuisineSeeds.map((cuisine) => cuisine.id));
const kitchenSlugs = new Set(kitchenSeeds.map((kitchen) => kitchen.slug));

const templateKeys = (id: keyof typeof menuTemplates) =>
  menuTemplates[id].flatMap((section) =>
    section.dishes.map((entry) => entry.replace(/^\?/, '')),
  );

describe('seed definitions', () => {
  it('has at least sixty kitchens with unique slugs', () => {
    expect(kitchenSeeds.length).toBeGreaterThanOrEqual(60);
    expect(kitchenSlugs.size).toBe(kitchenSeeds.length);
  });

  it('has unique dish keys', () => {
    expect(dishKeys.size).toBe(dishSeeds.length);
  });

  it('only uses dishes that exist in menu templates', () => {
    for (const id of Object.keys(menuTemplates) as Array<keyof typeof menuTemplates>) {
      for (const key of templateKeys(id)) {
        expect(dishKeys.has(key), `${id} uses unknown dish ${key}`).toBe(true);
      }
    }
  });

  it('places every kitchen in a known area with known cuisines', () => {
    for (const kitchen of kitchenSeeds) {
      expect(areaIds.has(kitchen.area), `${kitchen.slug} area`).toBe(true);
      expect(kitchen.cuisines.length).toBeGreaterThan(0);
      for (const cuisine of kitchen.cuisines) {
        expect(cuisineIds.has(cuisine), `${kitchen.slug} cuisine ${cuisine}`).toBe(true);
      }
    }
  });

  it('gives every kitchen signature dishes that its menu template contains', () => {
    for (const kitchen of kitchenSeeds) {
      const available = new Set(templateKeys(kitchen.menu));
      expect(kitchen.signature.length).toBeGreaterThan(0);
      for (const key of kitchen.signature) {
        expect(available.has(key), `${kitchen.slug} signature ${key}`).toBe(true);
      }
    }
  });

  it('gives every cuisine, kitchen and dish a photograph from the media manifest', () => {
    const used = [
      ...cuisineSeeds.map((cuisine) => cuisine.photo),
      ...kitchenSeeds.flatMap((kitchen) => [kitchen.photo, kitchen.profilePhoto]),
      ...dishSeeds.map((dish) => dish.photo),
    ];

    for (const key of used) {
      expect(photoKeys.has(key), `photo ${key} is missing from the manifest`).toBe(true);
    }
  });

  it('lists no photograph in the manifest that nothing uses', () => {
    const used = new Set([
      ...cuisineSeeds.map((cuisine) => cuisine.photo),
      ...kitchenSeeds.flatMap((kitchen) => [kitchen.photo, kitchen.profilePhoto]),
      ...dishSeeds.map((dish) => dish.photo),
    ]);

    expect([...photoKeys].filter((key) => !used.has(key))).toEqual([]);
  });

  it('never gives a kitchen the same photograph as cover and as profile', () => {
    for (const kitchen of kitchenSeeds) {
      expect(kitchen.profilePhoto, kitchen.slug).not.toBe(kitchen.photo);
    }
  });

  it('gives no two kitchens of the same cuisine the same cover', () => {
    const seen = new Map<string, string>();
    for (const kitchen of kitchenSeeds) {
      const key = `${kitchen.cuisines[0]}:${kitchen.photo}`;
      expect(seen.get(key), `${kitchen.slug} shares a cover`).toBeUndefined();
      seen.set(key, kitchen.slug);
    }
  });

  it('declares allergens for every dish, and for nothing else', () => {
    expect(Object.keys(dishAllergens).sort()).toEqual([...dishKeys].sort());

    for (const dish of dishSeeds) {
      for (const allergen of dish.allergens) {
        expect(ALLERGENS, `${dish.key}: ${allergen}`).toContain(allergen);
      }
      expect(dish.allergens, dish.key).toEqual(sortAllergens(dish.allergens));
    }
  });

  it('never calls a dish with fish or shellfish vegetarian', () => {
    for (const dish of dishSeeds) {
      if (!dish.tags.includes('vegetarian')) continue;
      expect(dish.allergens, dish.key).not.toContain('fish');
      expect(dish.allergens, dish.key).not.toContain('shellfish');
    }
  });

  it('only pairs dishes that exist', () => {
    for (const [dish, companions] of goesWith) {
      expect(dishKeys.has(dish), dish).toBe(true);
      expect(companions).not.toContain(dish);
      for (const companion of companions) {
        expect(dishKeys.has(companion), `${dish} with ${companion}`).toBe(true);
      }
    }
  });

  it('points promotions at kitchens and cuisines that exist', () => {
    for (const promotion of promotionSeeds) {
      if (promotion.kitchen) expect(kitchenSlugs.has(promotion.kitchen)).toBe(true);
      if (promotion.cuisine) expect(cuisineIds.has(promotion.cuisine)).toBe(true);
    }
  });
});

describe('buildMenu', () => {
  it('gives every kitchen a menu of at least five items, signatures included', () => {
    for (const kitchen of kitchenSeeds) {
      const items = buildMenu(kitchen).flatMap((section) => section.items);
      expect(items.length, kitchen.slug).toBeGreaterThanOrEqual(5);

      const popular = items.filter((item) => item.popular).map((item) => item.dish.key);
      expect(popular.sort(), kitchen.slug).toEqual([...kitchen.signature].sort());
    }
  });

  it('builds the same menu every time', () => {
    const kitchen = kitchenSeeds[0]!;
    expect(buildMenu(kitchen)).toEqual(buildMenu(kitchen));
  });
});

describe('scalePrice', () => {
  it('rounds to five taka below a hundred and to ten above', () => {
    expect(scalePrice(60, 0.9)).toBe(5500);
    expect(scalePrice(380, 0.9)).toBe(34000);
    expect(scalePrice(380, 1.2)).toBe(46000);
  });

  it('never prices anything below ten taka', () => {
    expect(scalePrice(5, 0.9)).toBe(1000);
  });
});
