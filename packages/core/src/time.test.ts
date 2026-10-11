import { describe, expect, it } from 'vitest';
import { dhakaDate, dhakaDayStart, dhakaMinuteOfDay, isOpenAt } from './time';

describe('dhakaMinuteOfDay', () => {
  it('is six hours ahead of UTC', () => {
    expect(dhakaMinuteOfDay(new Date('2026-10-11T00:00:00Z'))).toBe(6 * 60);
    expect(dhakaMinuteOfDay(new Date('2026-10-11T09:30:00Z'))).toBe(15 * 60 + 30);
  });

  it('wraps past midnight', () => {
    expect(dhakaMinuteOfDay(new Date('2026-10-11T19:15:00Z'))).toBe(75);
  });
});

describe('isOpenAt', () => {
  it('includes the opening minute and excludes the closing minute', () => {
    expect(isOpenAt(11 * 60, 23 * 60, 11 * 60)).toBe(true);
    expect(isOpenAt(11 * 60, 23 * 60, 23 * 60)).toBe(false);
    expect(isOpenAt(11 * 60, 23 * 60, 9 * 60)).toBe(false);
  });

  it('handles hours that run past midnight', () => {
    const opens = 18 * 60;
    const closes = 2 * 60;
    expect(isOpenAt(opens, closes, 23 * 60)).toBe(true);
    expect(isOpenAt(opens, closes, 60)).toBe(true);
    expect(isOpenAt(opens, closes, 12 * 60)).toBe(false);
  });

  it('treats equal opening and closing times as open all day', () => {
    expect(isOpenAt(0, 0, 3 * 60)).toBe(true);
  });
});

describe('dhakaDayStart and dhakaDate', () => {
  it('starts the day at 18:00 UTC of the day before', () => {
    const noon = new Date('2026-10-11T06:00:00Z');
    expect(dhakaDayStart(noon).toISOString()).toBe('2026-10-10T18:00:00.000Z');
    expect(dhakaDate(noon)).toBe('2026-10-11');
  });

  it('rolls over at midnight in Dhaka, not in UTC', () => {
    const justBefore = new Date('2026-10-11T17:59:59Z');
    const justAfter = new Date('2026-10-11T18:00:00Z');
    expect(dhakaDate(justBefore)).toBe('2026-10-11');
    expect(dhakaDate(justAfter)).toBe('2026-10-12');
    expect(dhakaDayStart(justAfter).toISOString()).toBe('2026-10-11T18:00:00.000Z');
  });
});
