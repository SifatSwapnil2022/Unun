import { TAKA, dhakaDate, dhakaMinuteOfDay, type Paisa } from '@unun/core';
import { intlLocale, type Locale } from '@/i18n/config';

const numberFormatters = new Map<string, Intl.NumberFormat>();

function numberFormatter(locale: Locale, minimumDigits = 1): Intl.NumberFormat {
  const key = `${locale}:${minimumDigits}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale[locale], {
      maximumFractionDigits: 0,
      minimumIntegerDigits: minimumDigits,
    });
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

/** Formats a whole number in the locale's digits: 1,250 in English, ১,২৫০ in Bangla. */
export function formatNumber(value: number, locale: Locale): string {
  return numberFormatter(locale).format(value);
}

const ratingFormatters = new Map<Locale, Intl.NumberFormat>();

/** Formats an average rating with one decimal place: 4.6 or ৪.৬, and 5.0 not 5. */
export function formatRating(average: number, locale: Locale): string {
  let formatter = ratingFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale[locale], {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    ratingFormatters.set(locale, formatter);
  }
  return formatter.format(average);
}

/** Formats paisa as whole taka with the taka sign: ৳490 or ৳৪৯০. */
export function formatTaka(amount: Paisa, locale: Locale): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}৳${formatNumber(Math.round(Math.abs(amount) / TAKA), locale)}`;
}

/** Bangla names the part of the day instead of saying am or pm. */
const BANGLA_DAY_PARTS: ReadonlyArray<[fromHour: number, name: string]> = [
  [20, 'রাত'],
  [18, 'সন্ধ্যা'],
  [15, 'বিকেল'],
  [12, 'দুপুর'],
  [6, 'সকাল'],
  [4, 'ভোর'],
  [0, 'রাত'],
];

/**
 * Formats minutes after midnight the way people say the time: "11 am" and "10:30 pm"
 * in English, "সকাল ১১টা" and "রাত ১০:৩০" in Bangla.
 */
export function formatMinuteOfDay(minutes: number, locale: Locale): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const hour = formatNumber(hour24 % 12 === 0 ? 12 : hour24 % 12, locale);
  const padded = numberFormatter(locale, 2).format(minute);

  if (locale === 'bn') {
    const part = BANGLA_DAY_PARTS.find(([fromHour]) => hour24 >= fromHour)?.[1] ?? '';
    return minute === 0 ? `${part} ${hour}টা` : `${part} ${hour}:${padded}`;
  }

  const half = hour24 < 12 ? 'am' : 'pm';
  return minute === 0 ? `${hour} ${half}` : `${hour}:${padded} ${half}`;
}

/** Formats an instant as a clock time in Dhaka, whatever the time zone of the device. */
export function formatClock(instant: string | Date, locale: Locale): string {
  return formatMinuteOfDay(dhakaMinuteOfDay(new Date(instant)), locale);
}

/*
 * Month and weekday names are written out here. Node and browsers do not always agree
 * on how a locale orders a date, and a page must read the same on both.
 */
const MONTHS: Record<Locale, readonly string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  bn: [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ],
};

const WEEKDAYS: Record<Locale, readonly string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  bn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'],
};

/** Formats a calendar date written as YYYY-MM-DD: "11 October" or "১১ অক্টোবর". */
export function formatDate(date: string, locale: Locale): string {
  const [, month = 1, day = 1] = date.split('-').map(Number);
  return `${formatNumber(day, locale)} ${MONTHS[locale][month - 1] ?? ''}`;
}

/** Formats an instant as a date in Dhaka. */
export function formatDay(instant: string | Date, locale: Locale): string {
  return formatDate(dhakaDate(new Date(instant)), locale);
}

/** The short weekday name of a calendar date written as YYYY-MM-DD: "Sun" or "রবি". */
export function formatWeekday(date: string, locale: Locale): string {
  return WEEKDAYS[locale][new Date(`${date}T12:00:00Z`).getUTCDay()] ?? '';
}

/** Formats a share from 0 to 1 as a whole percentage: "92%" or "৯২%". */
export function formatPercent(share: number, locale: Locale): string {
  return `${formatNumber(Math.round(share * 100), locale)}%`;
}

/** Picks the singular or plural wording for a count. */
export function plural(count: number, forms: { one: string; other: string }): string {
  return count === 1 ? forms.one : forms.other;
}
