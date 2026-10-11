export const LOCALES = ['en', 'bn'] as const;

export type Locale = (typeof LOCALES)[number];

/** A piece of text in both languages. */
export type Localized = Record<Locale, string>;

export const KITCHEN_TAGS = ['halal', 'vegetarian', 'nutFree'] as const;
export type KitchenTag = (typeof KITCHEN_TAGS)[number];

/** What a dish is like. What it contains is in allergens.ts. */
export const ITEM_TAGS = ['vegetarian', 'spicy'] as const;
export type ItemTag = (typeof ITEM_TAGS)[number];

export const PAYMENT_METHODS = ['cash', 'bkash', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
