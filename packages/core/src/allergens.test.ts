import { describe, expect, it } from 'vitest';
import { ALLERGENS, allergensToAvoid, isAllergen, sortAllergens } from './allergens';

describe('allergens', () => {
  it('knows its own list and nothing else', () => {
    for (const allergen of ALLERGENS) expect(isAllergen(allergen)).toBe(true);
    expect(isAllergen('dairy')).toBe(false);
    expect(isAllergen('')).toBe(false);
  });

  it('sorts into the standard order and drops repeats', () => {
    expect(sortAllergens(['mustard', 'milk', 'gluten', 'milk'])).toEqual([
      'gluten',
      'milk',
      'mustard',
    ]);
  });

  it('finds what a customer avoids in a dish', () => {
    expect(allergensToAvoid(['milk', 'nuts', 'gluten'], ['nuts', 'egg', 'milk'])).toEqual(
      ['milk', 'nuts'],
    );
  });

  it('calls a dish clear when nothing overlaps', () => {
    expect(allergensToAvoid(['fish', 'mustard'], ['milk'])).toEqual([]);
    expect(allergensToAvoid([], ['milk'])).toEqual([]);
    expect(allergensToAvoid(['milk'], [])).toEqual([]);
  });
});
