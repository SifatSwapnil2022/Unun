/**
 * What customers say after an order arrives: a rating for the kitchen, or a report that
 * something went wrong. Both belong to one delivered order. A rating without an order
 * cannot be stored, which is what makes a kitchen's average worth reading.
 */
import {
  arrivalOutcome,
  averageStars,
  canRate,
  canReport,
  paymentState,
  refundable,
  reviewerName,
  type IssueKind,
  type IssueStatus,
  type Paisa,
} from '@unun/core';
import type {
  AdminIssueDto,
  AdminIssues,
  AdminReviewDto,
  AdminReviews,
  IssueDto,
  KitchenDetail,
  OrderRatingDto,
  RatingSummary,
  ReviewDto,
} from '@unun/core/contracts';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  sql,
  sum,
  type SQL,
} from 'drizzle-orm';
import type { Database } from '../../db/client';
import { issues, kitchens, orderLines, orders, ratings } from '../../db/schema';
import { ApiError } from '../../http/errors';
import { loadOrders, paymentFacts, type OrderView, type Reader } from '../orders/read';
import { refundOrder, type PaymentDeps } from '../payments/service';

export type RatingRow = typeof ratings.$inferSelect;
export type IssueRow = typeof issues.$inferSelect;

/** What a customer has said about one order so far. */
export type Feedback = { rating: RatingRow | null; issues: IssueRow[] };

const NO_RATINGS: RatingSummary = { average: null, count: 0 };

/** How many dishes of an order a review names. */
const DISHES_PER_REVIEW = 2;

const visible: SQL = eq(ratings.hidden, false);

const deliveredAtOf = (view: OrderView): Date | null =>
  view.events.find((event) => event.status === 'delivered')?.at ?? null;

/* Reading */

/** The average rating of several kitchens, in one query. Kitchens with none are absent. */
export async function ratingsByKitchen(
  db: Reader,
  kitchenIds: number[],
): Promise<Map<number, RatingSummary>> {
  const result = new Map<number, RatingSummary>();
  if (kitchenIds.length === 0) return result;

  const rows = await db
    .select({ kitchenId: ratings.kitchenId, total: sum(ratings.stars), count: count() })
    .from(ratings)
    .where(and(inArray(ratings.kitchenId, kitchenIds), visible))
    .groupBy(ratings.kitchenId);

  for (const row of rows) {
    result.set(row.kitchenId, {
      average: averageStars(Number(row.total ?? 0), row.count),
      count: row.count,
    });
  }
  return result;
}

export async function ratingOfKitchen(
  db: Reader,
  kitchenId: number,
): Promise<RatingSummary> {
  return (await ratingsByKitchen(db, [kitchenId])).get(kitchenId) ?? NO_RATINGS;
}

type ReviewRow = {
  rating: RatingRow;
  customerName: string;
};

/** Adds to each rating the dearest dishes of the order it is about. */
async function withDishes(db: Reader, rows: ReviewRow[]): Promise<ReviewDto[]> {
  if (rows.length === 0) return [];

  const lines = await db
    .select({
      orderId: orderLines.orderId,
      nameEn: orderLines.nameEn,
      nameBn: orderLines.nameBn,
    })
    .from(orderLines)
    .where(
      inArray(
        orderLines.orderId,
        rows.map((row) => row.rating.orderId),
      ),
    )
    .orderBy(desc(orderLines.unitPrice), asc(orderLines.id));

  return rows.map(({ rating, customerName }) => ({
    id: rating.id,
    stars: rating.stars,
    comment: rating.comment,
    author: reviewerName(customerName),
    at: rating.createdAt.toISOString(),
    dishes: lines
      .filter((line) => line.orderId === rating.orderId)
      .slice(0, DISHES_PER_REVIEW)
      .map((line) => ({ en: line.nameEn, bn: line.nameBn })),
  }));
}

/** A kitchen's newest ratings. Hidden ones are left out. */
export async function reviewsOfKitchen(
  db: Reader,
  kitchenId: number,
  options: { limit: number; withComment: boolean },
): Promise<ReviewDto[]> {
  const rows = await db
    .select({ rating: ratings, customerName: orders.customerName })
    .from(ratings)
    .innerJoin(orders, eq(orders.id, ratings.orderId))
    .where(
      and(
        eq(ratings.kitchenId, kitchenId),
        visible,
        options.withComment ? isNotNull(ratings.comment) : undefined,
      ),
    )
    .orderBy(desc(ratings.createdAt), desc(ratings.id))
    .limit(options.limit);

  return withDishes(db, rows);
}

/** What a kitchen's own page shows: how its ratings are spread, and the latest words. */
export async function reviewsForPage(
  db: Reader,
  kitchenId: number,
): Promise<KitchenDetail['reviews']> {
  const [spread, latest] = await Promise.all([
    db
      .select({ stars: ratings.stars, count: count() })
      .from(ratings)
      .where(and(eq(ratings.kitchenId, kitchenId), visible))
      .groupBy(ratings.stars),
    reviewsOfKitchen(db, kitchenId, { limit: 6, withComment: true }),
  ]);

  const byStars: KitchenDetail['reviews']['byStars'] = [0, 0, 0, 0, 0];
  for (const row of spread) byStars[row.stars - 1] = row.count;
  return { byStars, latest };
}

/** The rating and the problem reports of one order. */
export async function feedbackOf(db: Reader, orderId: number): Promise<Feedback> {
  const [[rating], reported] = await Promise.all([
    db.select().from(ratings).where(eq(ratings.orderId, orderId)).limit(1),
    db
      .select()
      .from(issues)
      .where(eq(issues.orderId, orderId))
      .orderBy(desc(issues.createdAt), desc(issues.id)),
  ]);
  return { rating: rating ?? null, issues: reported };
}

export function toIssueDto(issue: IssueRow): IssueDto {
  return {
    id: issue.id,
    kind: issue.kind,
    detail: issue.detail,
    status: issue.status,
    createdAt: issue.createdAt.toISOString(),
    resolvedAt: issue.resolvedAt?.toISOString() ?? null,
    note: issue.note,
    refund: issue.refund,
  };
}

/** The feedback fields of an order as its customer sees them. */
export function feedbackFields(
  view: OrderView,
  feedback: Feedback,
  now: Date,
): {
  rating: OrderRatingDto | null;
  canRate: boolean;
  issues: IssueDto[];
  canReport: boolean;
} {
  const facts = { status: view.status, deliveredAt: deliveredAtOf(view), now };
  const { rating } = feedback;

  return {
    rating: rating
      ? {
          stars: rating.stars,
          comment: rating.comment,
          at: rating.createdAt.toISOString(),
        }
      : null,
    canRate: canRate({ ...facts, rated: rating !== null }),
    issues: feedback.issues.map(toIssueDto),
    canReport: canReport({
      ...facts,
      open: feedback.issues.some((issue) => issue.status === 'open'),
      reported: feedback.issues.length,
    }),
  };
}

/* What a customer does */

async function viewByToken(db: Database, token: string, now: Date): Promise<OrderView> {
  const [view] = await loadOrders(db, now, { where: eq(orders.token, token), limit: 1 });
  if (!view) throw new ApiError('not_found', 'There is no order for this link.');
  return view;
}

/** Rates a delivered order. Whoever holds the order's link may rate it, once. */
export async function rateOrder(
  db: Database,
  input: { token: string; stars: number; comment?: string; now: Date },
): Promise<void> {
  const { now } = input;
  const view = await viewByToken(db, input.token, now);
  const { rating } = await feedbackOf(db, view.order.id);

  const allowed = canRate({
    status: view.status,
    deliveredAt: deliveredAtOf(view),
    now,
    rated: rating !== null,
  });
  if (!allowed) {
    throw new ApiError(
      'invalid_transition',
      rating
        ? 'This order has already been rated.'
        : 'An order can be rated once it has been delivered, for two weeks.',
    );
  }

  // Two taps at once: the unique index lets one through and the other changes nothing.
  await db
    .insert(ratings)
    .values({
      orderId: view.order.id,
      kitchenId: view.order.kitchenId,
      stars: input.stars,
      comment: input.comment || null,
      createdAt: now,
    })
    .onConflictDoNothing({ target: ratings.orderId });
}

/** Reports a problem with a delivered order. */
export async function reportIssue(
  db: Database,
  input: { token: string; kind: IssueKind; detail: string; now: Date },
): Promise<void> {
  const { now } = input;
  const view = await viewByToken(db, input.token, now);
  const feedback = await feedbackOf(db, view.order.id);
  const open = feedback.issues.some((issue) => issue.status === 'open');

  const allowed = canReport({
    status: view.status,
    deliveredAt: deliveredAtOf(view),
    now,
    open,
    reported: feedback.issues.length,
  });
  if (!allowed) {
    throw new ApiError(
      open ? 'already_taken' : 'invalid_transition',
      open
        ? 'Your last report on this order is still being looked at.'
        : 'A problem can be reported for two days after the order is delivered.',
    );
  }

  const stored = await db
    .insert(issues)
    .values({
      orderId: view.order.id,
      kind: input.kind,
      detail: input.detail,
      createdAt: now,
    })
    // The index allows one open report per order, whatever two requests do at once.
    .onConflictDoNothing()
    .returning({ id: issues.id });
  if (stored.length === 0) {
    throw new ApiError(
      'already_taken',
      'Your last report on this order is still being looked at.',
    );
  }
}

/* What support staff do */

export const ISSUE_SCOPES = ['open', 'answered', 'all'] as const;
export type IssueScope = (typeof ISSUE_SCOPES)[number];

export async function countOpenIssues(db: Reader): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(issues)
    .where(eq(issues.status, 'open'));
  return row?.total ?? 0;
}

function toAdminIssue(issue: IssueRow, view: OrderView): AdminIssueDto {
  const { order } = view;
  const facts = paymentFacts(view);
  const delivered = view.events.find((event) => event.status === 'delivered');

  return {
    ...toIssueDto(issue),
    order: {
      publicId: order.publicId,
      token: order.token,
      kitchen: { en: view.kitchen.nameEn, bn: view.kitchen.nameBn },
      lines: view.lines.map((line) => ({
        name: { en: line.nameEn, bn: line.nameBn },
        quantity: line.quantity,
      })),
      total: order.total,
      refundable: refundable(facts),
      payment: {
        method: order.paymentMethod,
        state: paymentState(facts),
        refunded: order.refunded,
      },
      customer: { name: order.customerName, phone: order.customerPhone },
      deliveredAt: delivered?.at.toISOString() ?? null,
      arrival: delivered
        ? arrivalOutcome(delivered.minute, {
            min: order.windowMin,
            max: order.windowMax,
          })
        : null,
    },
  };
}

/** Problem reports for support staff: the ones waiting first, oldest of those first. */
export async function listIssues(
  db: Database,
  input: { scope: IssueScope; now: Date },
): Promise<AdminIssues> {
  const where: Record<IssueScope, SQL | undefined> = {
    open: eq(issues.status, 'open'),
    answered: sql`${issues.status} <> 'open'`,
    all: undefined,
  };

  const [rows, open] = await Promise.all([
    db
      .select()
      .from(issues)
      .where(where[input.scope])
      .orderBy(
        sql`(${issues.status} = 'open') desc`,
        input.scope === 'open' ? asc(issues.createdAt) : desc(issues.createdAt),
      )
      .limit(60),
    countOpenIssues(db),
  ]);
  if (rows.length === 0) return { open, issues: [] };

  const views = await loadOrders(db, input.now, {
    where: inArray(orders.id, [...new Set(rows.map((row) => row.orderId))]),
    limit: rows.length,
  });
  const viewOf = new Map(views.map((view) => [view.order.id, view]));

  return {
    open,
    issues: rows.flatMap((row) => {
      const view = viewOf.get(row.orderId);
      return view ? [toAdminIssue(row, view)] : [];
    }),
  };
}

/**
 * Answers a report. With an amount, the money goes back the way it came and the report
 * is marked refunded; with none, it is closed. Either way the customer is told why.
 */
export async function resolveIssue(
  db: Database,
  deps: PaymentDeps,
  input: { id: number; refund: Paisa; note: string; byUserId: number; now: Date },
): Promise<void> {
  const { id, refund, note, byUserId, now } = input;

  const [issue] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
  if (!issue) throw new ApiError('not_found', 'There is no such report.');
  if (issue.status !== 'open') {
    throw new ApiError('invalid_transition', 'This report has already been answered.');
  }

  // The report is claimed before any money moves, so two admins cannot both refund it.
  const status: IssueStatus = refund > 0 ? 'refunded' : 'closed';
  const claimed = await db
    .update(issues)
    .set({ status, note, refund, resolvedBy: byUserId, resolvedAt: now })
    .where(and(eq(issues.id, id), eq(issues.status, 'open')))
    .returning({ id: issues.id });
  if (claimed.length === 0) {
    throw new ApiError('invalid_transition', 'This report has already been answered.');
  }
  if (refund === 0) return;

  try {
    await refundOrder(db, deps, {
      orderId: issue.orderId,
      amount: refund,
      reason: note,
      issueId: issue.id,
      byUserId,
      now,
    });
  } catch (error) {
    // No money went back, so the report is open again for another decision.
    await db
      .update(issues)
      .set({ status: 'open', note: null, refund: 0, resolvedBy: null, resolvedAt: null })
      .where(eq(issues.id, id));
    throw error;
  }
}

/** Every rating, newest first, for support staff to read and to hide. */
export async function listReviews(
  db: Database,
  input: { hiddenOnly: boolean },
): Promise<AdminReviews> {
  const where = input.hiddenOnly ? eq(ratings.hidden, true) : undefined;

  const [rows, [total]] = await Promise.all([
    db
      .select({
        rating: ratings,
        customerName: orders.customerName,
        publicId: orders.publicId,
        token: orders.token,
        slug: kitchens.slug,
        nameEn: kitchens.nameEn,
        nameBn: kitchens.nameBn,
      })
      .from(ratings)
      .innerJoin(orders, eq(orders.id, ratings.orderId))
      .innerJoin(kitchens, eq(kitchens.id, ratings.kitchenId))
      .where(where)
      .orderBy(desc(ratings.createdAt), desc(ratings.id))
      .limit(60),
    db.select({ total: count() }).from(ratings).where(where),
  ]);

  const reviews = await withDishes(db, rows);
  return {
    total: total?.total ?? 0,
    reviews: rows.map((row, index): AdminReviewDto => ({
      ...reviews[index]!,
      hidden: row.rating.hidden,
      kitchen: { slug: row.slug, name: { en: row.nameEn, bn: row.nameBn } },
      order: { publicId: row.publicId, token: row.token },
    })),
  };
}

/** Hides a rating from customers, or shows it again. A hidden rating does not count. */
export async function moderateReview(
  db: Database,
  input: { id: number; hidden: boolean },
): Promise<void> {
  const changed = await db
    .update(ratings)
    .set({ hidden: input.hidden })
    .where(eq(ratings.id, input.id))
    .returning({ id: ratings.id });
  if (changed.length === 0) throw new ApiError('not_found', 'There is no such rating.');
}
