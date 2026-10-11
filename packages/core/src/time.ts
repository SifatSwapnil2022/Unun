/**
 * Clock rules. Bangladesh uses UTC+6 all year, so Dhaka time is a fixed offset and
 * needs no time zone database.
 */
export const DHAKA_TIME_ZONE = 'Asia/Dhaka';

const DHAKA_OFFSET_MINUTES = 6 * 60;
const MINUTES_PER_DAY = 24 * 60;

/** Minutes after midnight in Dhaka at the given instant. */
export function dhakaMinuteOfDay(instant: Date): number {
  const utcMinutes = instant.getUTCHours() * 60 + instant.getUTCMinutes();
  return (utcMinutes + DHAKA_OFFSET_MINUTES) % MINUTES_PER_DAY;
}

/**
 * Whether a kitchen is open at a minute of the day. Hours that run past midnight
 * (18:00 to 02:00) are written with a closing time smaller than the opening time.
 */
export function isOpenAt(opens: number, closes: number, minuteOfDay: number): boolean {
  if (opens === closes) return true;
  return opens < closes
    ? minuteOfDay >= opens && minuteOfDay < closes
    : minuteOfDay >= opens || minuteOfDay < closes;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = MINUTES_PER_DAY * MS_PER_MINUTE;
const DHAKA_OFFSET_MS = DHAKA_OFFSET_MINUTES * MS_PER_MINUTE;

/** The instant the current day began in Dhaka. */
export function dhakaDayStart(instant: Date): Date {
  const local = instant.getTime() + DHAKA_OFFSET_MS;
  return new Date(Math.floor(local / MS_PER_DAY) * MS_PER_DAY - DHAKA_OFFSET_MS);
}

/** The calendar date in Dhaka at the given instant, as YYYY-MM-DD. */
export function dhakaDate(instant: Date): string {
  return new Date(instant.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}
