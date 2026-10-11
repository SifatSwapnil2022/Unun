/**
 * Moving an order by hand. Kitchens that have switched autopilot off, and the riders
 * who deliver for them, add one event at a time. The rules for who may do what live in
 * @unun/core; this file applies them and stores the result.
 */
import {
  actorOf,
  canCancel,
  canTransition,
  isOpenToRiders,
  type OrderStep,
} from '@unun/core';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { kitchens, orderEvents, orders, payments } from '../../db/schema';
import { ApiError } from '../../http/errors';
import { refundInFull, type PaymentDeps } from '../payments/service';
import { inProgress, statusOf, type OrderRow } from './read';

const MINUTE_MS = 60_000;

/** Whole minutes of order time between placing the order and `now`. */
const minuteOf = (order: OrderRow, now: Date) =>
  Math.max(
    Math.floor(
      ((now.getTime() - order.placedAt.getTime()) * order.timeScale) / MINUTE_MS,
    ),
    0,
  );

const noSuchOrder = () => new ApiError('not_found', 'There is no such order.');

async function findOrder(db: Database, publicId: string) {
  const [row] = await db
    .select({ order: orders, ownerId: kitchens.ownerId })
    .from(orders)
    .innerJoin(kitchens, eq(kitchens.id, orders.kitchenId))
    .where(eq(orders.publicId, publicId))
    .limit(1);
  return row ?? null;
}

/** Who is asking. Staff may only touch orders that are theirs. */
export type Actor =
  | { kind: 'kitchen'; ownerId: number }
  | { kind: 'rider'; riderId: number }
  | { kind: 'admin' };

/** The order, if the actor is allowed to see it. Otherwise it does not exist to them. */
async function findOrderFor(db: Database, publicId: string, actor: Actor) {
  const found = await findOrder(db, publicId);
  if (!found) throw noSuchOrder();
  // An unpaid order has not reached the kitchen. Only support staff can see it.
  if (found.order.awaitingPayment && actor.kind !== 'admin') throw noSuchOrder();

  const allowed =
    actor.kind === 'admin' ||
    (actor.kind === 'kitchen' && found.ownerId === actor.ownerId) ||
    (actor.kind === 'rider' && found.order.riderId === actor.riderId);
  if (!allowed) throw noSuchOrder();

  return found.order;
}

/** Moves an order one step forward, as the kitchen or the rider. */
export async function advanceOrder(
  db: Database,
  input: {
    publicId: string;
    to: OrderStep;
    actor: Exclude<Actor, { kind: 'admin' }>;
    now: Date;
  },
): Promise<void> {
  const { publicId, to, actor, now } = input;
  const order = await findOrderFor(db, publicId, actor);

  if (order.autopilot) {
    throw new ApiError(
      'invalid_transition',
      'This order is on autopilot and moves by itself.',
    );
  }
  if (actorOf(to) !== actor.kind) {
    throw new ApiError('forbidden', 'This step is not yours to take.');
  }

  const status = await statusOf(db, order.id, now);
  if (status === to) return; // A repeated click. The step is already taken.
  if (!canTransition(status, to)) {
    throw new ApiError(
      'invalid_transition',
      `An order that is "${status}" cannot become "${to}".`,
      { status },
    );
  }

  // The unique key on (order, status) makes a second, racing request a no-op.
  await db
    .insert(orderEvents)
    .values({ orderId: order.id, status: to, at: now, minute: minuteOf(order, now) })
    .onConflictDoNothing();
}

/** Gives a waiting delivery to a rider. Only one rider can win it. */
export async function claimOrder(
  db: Database,
  input: { publicId: string; riderId: number; now: Date },
): Promise<void> {
  const { publicId, riderId, now } = input;

  const found = await findOrder(db, publicId);
  if (!found || found.order.autopilot || found.order.awaitingPayment) throw noSuchOrder();
  if (found.order.riderId === riderId) return;

  const [busy] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.riderId, riderId), inProgress(db, now)))
    .limit(1);
  if (busy) {
    throw new ApiError('limit_reached', 'Finish the delivery you are on first.');
  }

  const status = await statusOf(db, found.order.id, now);
  if (!isOpenToRiders(status)) {
    throw new ApiError('invalid_transition', 'This order is not waiting for a rider.', {
      status,
    });
  }

  // Taking the job and checking that nobody else has it happen in one statement.
  const taken = await db
    .update(orders)
    .set({ riderId })
    .where(and(eq(orders.id, found.order.id), isNull(orders.riderId)))
    .returning({ id: orders.id });
  if (taken.length === 0) {
    throw new ApiError('already_taken', 'Another rider has taken this delivery.');
  }
}

/** Ends an order before delivery: a kitchen declining it, or support staff cancelling. */
export async function cancelOrder(
  db: Database,
  deps: PaymentDeps,
  input: {
    publicId: string;
    reason: string;
    actor: Exclude<Actor, { kind: 'rider' }>;
    /** The admin cancelling, for the record of the refund. Null for a kitchen. */
    byUserId: number | null;
    now: Date;
  },
): Promise<void> {
  const { publicId, reason, actor, byUserId, now } = input;
  const order = await findOrderFor(db, publicId, actor);

  if (actor.kind === 'kitchen' && order.autopilot) {
    throw new ApiError(
      'invalid_transition',
      'This order is on autopilot and cannot be declined.',
    );
  }

  await db.transaction(async (tx) => {
    const status = await statusOf(tx, order.id, now);
    if (!canCancel(status, actor.kind)) {
      throw new ApiError(
        'invalid_transition',
        `An order that is "${status}" cannot be cancelled.`,
        { status },
      );
    }

    // On autopilot the rest of the journey is already stored. It will not happen now.
    await tx
      .delete(orderEvents)
      .where(and(eq(orderEvents.orderId, order.id), gt(orderEvents.at, now)));
    await tx.insert(orderEvents).values({
      orderId: order.id,
      status: 'cancelled',
      at: now,
      minute: minuteOf(order, now),
    });
    await tx
      .update(orders)
      .set({ cancelReason: reason, awaitingPayment: false })
      .where(eq(orders.id, order.id));
    // A payment the customer had not finished is closed with the order.
    await tx
      .update(payments)
      .set({ status: 'cancelled', completedAt: now })
      .where(and(eq(payments.orderId, order.id), eq(payments.status, 'pending')));
  });

  // Money already paid online goes back in full. Nothing was paid for a cash order.
  await refundInFull(db, deps, { orderId: order.id, reason, byUserId, now });
}
