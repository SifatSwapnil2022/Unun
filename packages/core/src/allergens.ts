/**
 * What a dish contains that some people must avoid. The list is short on purpose: the
 * things that turn up in Dhaka cooking, named the way a customer would ask about them.
 */
export const ALLERGENS = [
  'gluten',
  'milk',
  'egg',
  'fish',
  'shellfish',
  'nuts',
  'peanut',
  'soy',
  'sesame',
  'mustard',
] as const;

export type Allergen = (typeof ALLERGENS)[number];

export function isAllergen(value: string): value is Allergen {
  return (ALLERGENS as readonly string[]).includes(value);
}

/** Puts a list in the standard order and drops repeats, so equal lists compare equal. */
export function sortAllergens(list: readonly Allergen[]): Allergen[] {
  return ALLERGENS.filter((allergen) => list.includes(allergen));
}

/** Which of the things a customer avoids are in a dish. Empty means the dish is clear. */
export function allergensToAvoid(
  contains: readonly Allergen[],
  avoiding: readonly Allergen[],
): Allergen[] {
  return ALLERGENS.filter(
    (allergen) => contains.includes(allergen) && avoiding.includes(allergen),
  );
}
