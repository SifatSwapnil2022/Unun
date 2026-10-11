import { taka } from '@unun/core';
import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatDay,
  formatMinuteOfDay,
  formatNumber,
  formatPercent,
  formatTaka,
  formatWeekday,
  plural,
} from './format';

describe('formatTaka', () => {
  it('writes whole taka with the taka sign in English digits', () => {
    expect(formatTaka(taka(490), 'en')).toBe('৳490');
    expect(formatTaka(taka(1250), 'en')).toBe('৳1,250');
  });

  it('uses Bangla digits in the Bangla locale', () => {
    expect(formatTaka(taka(490), 'bn')).toBe('৳৪৯০');
  });

  it('shows a discount with a minus sign in front of the taka sign', () => {
    expect(formatTaka(-taka(100), 'en')).toBe('−৳100');
  });
});

describe('formatNumber', () => {
  it('formats counts in the locale digits', () => {
    expect(formatNumber(9, 'en')).toBe('9');
    expect(formatNumber(36, 'bn')).toBe('৩৬');
  });
});

describe('formatMinuteOfDay', () => {
  it('writes English times with am and pm, without empty minutes', () => {
    expect(formatMinuteOfDay(11 * 60, 'en')).toBe('11 am');
    expect(formatMinuteOfDay(22 * 60 + 30, 'en')).toBe('10:30 pm');
    expect(formatMinuteOfDay(13 * 60 + 5, 'en')).toBe('1:05 pm');
  });

  it('calls midnight 12 am and noon 12 pm', () => {
    expect(formatMinuteOfDay(0, 'en')).toBe('12 am');
    expect(formatMinuteOfDay(12 * 60, 'en')).toBe('12 pm');
  });

  it('names the part of the day in Bangla', () => {
    expect(formatMinuteOfDay(11 * 60, 'bn')).toBe('সকাল ১১টা');
    expect(formatMinuteOfDay(22 * 60 + 30, 'bn')).toBe('রাত ১০:৩০');
    expect(formatMinuteOfDay(15 * 60, 'bn')).toBe('বিকেল ৩টা');
    expect(formatMinuteOfDay(2 * 60, 'bn')).toBe('রাত ২টা');
  });
});

describe('formatClock', () => {
  it('shows the time in Dhaka, whatever the time zone of the machine', () => {
    // 07:34 UTC is 13:34 in Dhaka.
    expect(formatClock('2026-10-11T07:34:00Z', 'en')).toBe('1:34 pm');
    expect(formatClock('2026-10-11T07:34:00Z', 'bn')).toBe('দুপুর ১:৩৪');
  });

  it('accepts a Date as well as a string', () => {
    expect(formatClock(new Date('2026-10-11T18:00:00Z'), 'en')).toBe('12 am');
  });
});

describe('formatDay and formatWeekday', () => {
  it('shows the date in Dhaka, where the day starts six hours before UTC', () => {
    // 19:00 UTC on the 11th is 01:00 on the 12th in Dhaka.
    expect(formatDay('2026-10-11T19:00:00Z', 'en')).toBe('12 October');
    expect(formatDay('2026-10-11T19:00:00Z', 'bn')).toBe('১২ অক্টোবর');
    expect(formatDay('2026-10-11T07:00:00Z', 'en')).toBe('11 October');
  });

  it('names the weekday of a calendar date', () => {
    expect(formatWeekday('2026-10-11', 'en')).toBe('Sun');
    expect(formatWeekday('2026-10-11', 'bn')).toBe('রবি');
    expect(formatWeekday('2026-10-16', 'en')).toBe('Fri');
  });
});

describe('formatPercent', () => {
  it('rounds a share to a whole percentage', () => {
    expect(formatPercent(0.916, 'en')).toBe('92%');
    expect(formatPercent(1, 'bn')).toBe('১০০%');
  });
});

describe('plural', () => {
  it('chooses the wording by count', () => {
    const forms = { one: '{count} item', other: '{count} items' };
    expect(plural(1, forms)).toBe('{count} item');
    expect(plural(3, forms)).toBe('{count} items');
    expect(plural(0, forms)).toBe('{count} items');
  });
});
