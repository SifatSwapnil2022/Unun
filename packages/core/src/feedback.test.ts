import { describe, expect, it } from 'vitest';
import {
  ISSUE_WINDOW_HOURS,
  MAX_ISSUES_PER_ORDER,
  RATING_WINDOW_DAYS,
  averageStars,
  canRate,
  canReport,
  reviewerName,
} from './feedback';

const delivered = new Date('2026-10-11T12:00:00Z');
const hoursLater = (hours: number) => new Date(delivered.getTime() + hours * 3_600_000);

describe('canRate', () => {
  const facts = { status: 'delivered', deliveredAt: delivered, rated: false } as const;

  it('allows one rating for a delivered order', () => {
    expect(canRate({ ...facts, now: hoursLater(1) })).toBe(true);
    expect(canRate({ ...facts, rated: true, now: hoursLater(1) })).toBe(false);
  });

  it('refuses an order that has not been delivered', () => {
    for (const status of ['placed', 'cooking', 'picked_up', 'cancelled'] as const) {
      expect(canRate({ status, deliveredAt: null, rated: false, now: delivered })).toBe(
        false,
      );
    }
  });

  it('closes after the rating window', () => {
    const edge = RATING_WINDOW_DAYS * 24;
    expect(canRate({ ...facts, now: hoursLater(edge) })).toBe(true);
    expect(canRate({ ...facts, now: hoursLater(edge + 1) })).toBe(false);
  });

  it('refuses a delivery that is still in the future', () => {
    expect(canRate({ ...facts, now: hoursLater(-1) })).toBe(false);
  });
});

describe('averageStars', () => {
  it('rounds to one decimal place', () => {
    expect(averageStars(23, 5)).toBe(4.6);
    expect(averageStars(14, 3)).toBe(4.7);
    expect(averageStars(5, 1)).toBe(5);
  });

  it('is null with no ratings', () => {
    expect(averageStars(0, 0)).toBeNull();
  });
});

describe('reviewerName', () => {
  it('keeps the first name and one initial', () => {
    expect(reviewerName('Mitu Rahman')).toBe('Mitu R.');
    expect(reviewerName('  Md Sifatullah   Sheikh ')).toBe('Md S.');
  });

  it('keeps a single name as it is', () => {
    expect(reviewerName('Rahim')).toBe('Rahim');
  });

  it('takes a whole Bangla letter as the initial', () => {
    expect(reviewerName('মিতু রহমান')).toBe('মিতু র.');
  });

  it('is empty for an empty name', () => {
    expect(reviewerName('   ')).toBe('');
  });
});

describe('canReport', () => {
  const facts = {
    status: 'delivered',
    deliveredAt: delivered,
    open: false,
    reported: 0,
  } as const;

  it('allows a report for two days after delivery', () => {
    expect(canReport({ ...facts, now: hoursLater(1) })).toBe(true);
    expect(canReport({ ...facts, now: hoursLater(ISSUE_WINDOW_HOURS) })).toBe(true);
    expect(canReport({ ...facts, now: hoursLater(ISSUE_WINDOW_HOURS + 1) })).toBe(false);
  });

  it('takes one report at a time', () => {
    expect(canReport({ ...facts, open: true, now: hoursLater(1) })).toBe(false);
  });

  it('stops after a few reports on the same order', () => {
    expect(
      canReport({ ...facts, reported: MAX_ISSUES_PER_ORDER, now: hoursLater(1) }),
    ).toBe(false);
  });

  it('refuses an order that was not delivered', () => {
    expect(
      canReport({ ...facts, status: 'cancelled', deliveredAt: null, now: delivered }),
    ).toBe(false);
    expect(
      canReport({ ...facts, status: 'picked_up', deliveredAt: null, now: delivered }),
    ).toBe(false);
  });
});
