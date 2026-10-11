export const locales = ['en', 'bn'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** BCP 47 tags used for number and date formatting. */
export const intlLocale: Record<Locale, string> = {
  en: 'en-BD',
  bn: 'bn-BD',
};
