/**
 * What a customer can say about an order after it arrives: a rating for the kitchen,
 * or a report that something went wrong. Both hang off one delivered order, which is
 * what makes a rating worth reading: nobody can rate food they did not receive.
 */
import type { OrderStatus } from './orders';

const HOUR_MS = 60 * 60 * 1000;

export const MIN_STARS = 1;
export const MAX_STARS = 5;

/** A delivered order can be rated for this long. */
export const RATING_WINDOW_DAYS = 14;

export const COMMENT_MAX_LENGTH = 300;

/** What the people deciding need to know about the order. */
export type FeedbackFacts = {
  status: OrderStatus;
  /** When the order was delivered. Null until it is. */
  deliveredAt: Date | null;
  now: Date;
};

/** One rating per delivered order, while the meal is still fresh in mind. */
export function canRate(facts: FeedbackFacts & { rated: boolean }): boolean {
  if (facts.rated || facts.status !== 'delivered' || !facts.deliveredAt) return false;
  const age = facts.now.getTime() - facts.deliveredAt.getTime();
  return age >= 0 && age <= RATING_WINDOW_DAYS * 24 * HOUR_MS;
}

/** The average of some ratings to one decimal place: 4.6. Null when there are none. */
export function averageStars(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 10) / 10;
}

/** How a reviewer is named in public: first name and one initial, "Mitu R." */
export function reviewerName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first, ...rest] = words;
  if (!first) return '';
  const last = rest.at(-1);
  return last ? `${first} ${[...last][0]}.` : first;
}

/** What can go wrong with an order that says it was delivered. */
export const ISSUE_KINDS = [
  'missing_item',
  'wrong_item',
  'quality',
  'never_arrived',
  'late',
  'other',
] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number];

/** Open until support staff look at it; then money went back, or it did not. */
export const ISSUE_STATUSES = ['open', 'refunded', 'closed'] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** A problem can be reported for this long after delivery. */
export const ISSUE_WINDOW_HOURS = 48;

/** Enough for a second look, not enough to flood support staff. */
export const MAX_ISSUES_PER_ORDER = 3;

export const ISSUE_DETAIL_MIN_LENGTH = 10;
export const ISSUE_DETAIL_MAX_LENGTH = 500;

/**
 * A problem can be reported once the order is delivered, for two days, one report at a
 * time. An order still on its way has nothing to report yet; a cancelled one was
 * refunded when it was cancelled.
 */
export function canReport(
  facts: FeedbackFacts & { open: boolean; reported: number },
): boolean {
  if (facts.open || facts.reported >= MAX_ISSUES_PER_ORDER) return false;
  if (facts.status !== 'delivered' || !facts.deliveredAt) return false;
  const age = facts.now.getTime() - facts.deliveredAt.getTime();
  return age >= 0 && age <= ISSUE_WINDOW_HOURS * HOUR_MS;
}
