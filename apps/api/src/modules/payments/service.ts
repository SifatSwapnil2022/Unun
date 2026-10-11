/**
 * Paying online, and giving money back.
 *
 * An order paid online is stored when the customer places it, but it waits: it has no
 * events and the kitchen is not told. When the gateway says the money has arrived, the
 * order's journey starts. If the customer never pays, the order lapses.
 */
import { randomBytes } from 'node:crypto';
import {
  PAYMENT_WINDOW_MINUTES,
  SYSTEM_REASONS,
  isOnline,
  refundable,
  type Paisa,
} from '@unun/core';
import type { OpenPayment, PaymentDto, SandboxOutcome } from '@unun/core/contracts';
import { and, desc, eq, isNull, lt, sql, type SQL } from 'drizzle-orm';
import type { Config } from '../../config';
import type { Database } from '../../db/client';
import { kitchens, orderEvents, orders, payments, refunds } from '../../db/schema';
import { ApiError } from '../../http/errors';
import { startJourney } from '../orders/journey';
import { statusOf, type OrderRow } from '../orders/read';
import type { Gateways } from './gateways';

export type PaymentRow = typeof payments.$inferSelect;
export type RefundRow = typeof refunds.$inferSelect;

export type PaymentDeps = { config: Config; gateways: Gateways };

const WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60_000;

const newToken = () => randomBytes(18).toString('base64url');

/** When an unpaid order lapses. */
export const paymentDeadline = (order: Pick<OrderRow, 'placedAt'>) =>
  new Date(order.placedAt.getTime() + WINDOW_MS);

const noSuchPayment = () => new ApiError('not_found', 'There is no such payment.');

/** The payment an order is waiting on, if it has one open. */
export async function findOpenPayment(
  db: Pick<Database, 'select'>,
  orderId: number,
): Promise<PaymentRow | null> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, 'pending')))
    .orderBy(desc(payments.id))
    .limit(1);
  return payment ?? null;
}

const toOpen = (payment: PaymentRow): OpenPayment => ({
  token: payment.token,
  url: payment.redirectUrl,
});

/**
 * Opens a payment for an order that is waiting for one. The gateway is asked first, so
 * a gateway that cannot be reached leaves nothing behind.
 */
export async function openPayment(
  db: Database,
  deps: PaymentDeps,
  order: OrderRow,
  now: Date,
): Promise<OpenPayment> {
  const gateway = deps.gateways.forMethod(order.paymentMethod);

  let started: Awaited<ReturnType<typeof gateway.start>>;
  try {
    started = await gateway.start({
      amount: order.total,
      invoice: order.publicId,
      payerPhone: order.customerPhone,
      callbackUrl: `${deps.config.publicApiUrl}/v1/payments/bkash/callback`,
    });
  } catch (error) {
    console.error(error);
    throw new ApiError(
      'payment_unavailable',
      'The payment service could not be reached. Try again, or pay in cash.',
    );
  }

  const payment = await db.transaction(async (tx) => {
    // An order has one open payment at a time. Starting again closes the one before.
    await tx
      .update(payments)
      .set({ status: 'cancelled', completedAt: now })
      .where(and(eq(payments.orderId, order.id), eq(payments.status, 'pending')));

    const [created] = await tx
      .insert(payments)
      .values({
        orderId: order.id,
        token: newToken(),
        provider: gateway.provider,
        method: order.paymentMethod,
        amount: order.total,
        providerRef: started.ref,
        redirectUrl: started.url,
        createdAt: now,
      })
      .returning();
    if (!created) throw new Error('The payment row was not created');
    return created;
  });

  return toOpen(payment);
}

/** Cancels an order whose payment window has closed. Returns true if it did. */
export async function lapseIfUnpaid(
  db: Database,
  order: OrderRow,
  now: Date,
): Promise<boolean> {
  if (!order.awaitingPayment || paymentDeadline(order).getTime() > now.getTime()) {
    return false;
  }

  return db.transaction(async (tx) => {
    // Claiming the order and checking it is still waiting happen in one statement.
    const claimed = await tx
      .update(orders)
      .set({ awaitingPayment: false, cancelReason: SYSTEM_REASONS.paymentTimeout })
      .where(and(eq(orders.id, order.id), eq(orders.awaitingPayment, true)))
      .returning({ id: orders.id });
    if (claimed.length === 0) return false;

    await tx
      .insert(orderEvents)
      .values({ orderId: order.id, status: 'cancelled', at: now, minute: 0 });
    await tx
      .update(payments)
      .set({ status: 'expired', completedAt: now })
      .where(and(eq(payments.orderId, order.id), eq(payments.status, 'pending')));
    return true;
  });
}

/** Lapses every unpaid order whose window has closed. Cheap enough to run on a read. */
export async function lapseUnpaidOrders(db: Database, now: Date): Promise<void> {
  const stale = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.awaitingPayment, true),
        lt(orders.placedAt, new Date(now.getTime() - WINDOW_MS)),
      ),
    )
    .limit(100);
  for (const order of stale) await lapseIfUnpaid(db, order, now);
}

async function loadPayment(db: Database, where: SQL | undefined) {
  const [row] = await db
    .select({ payment: payments, order: orders, kitchen: kitchens })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(kitchens, eq(kitchens.id, orders.kitchenId))
    .where(where)
    .limit(1);
  return row ?? null;
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadPayment>>>;

const toDto = ({ payment, order, kitchen }: Loaded): PaymentDto => ({
  token: payment.token,
  method: payment.method,
  provider: payment.provider,
  status: payment.status,
  amount: payment.amount,
  expiresAt: paymentDeadline(order).toISOString(),
  order: {
    publicId: order.publicId,
    token: order.token,
    kitchen: { en: kitchen.nameEn, bn: kitchen.nameBn },
  },
});

/** A payment as its page shows it. Whoever holds the address may read it. */
export async function getPayment(
  db: Database,
  token: string,
  now: Date,
): Promise<PaymentDto> {
  const loaded = await loadPayment(db, eq(payments.token, token));
  if (!loaded) throw noSuchPayment();

  if (await lapseIfUnpaid(db, loaded.order, now)) {
    return toDto({ ...loaded, payment: { ...loaded.payment, status: 'expired' } });
  }
  return toDto(loaded);
}

type Settlement = {
  status: 'paid' | 'failed' | 'cancelled';
  trx: string | null;
  now: Date;
  random: () => number;
};

/**
 * Records how a payment ended. A paid one starts the order's journey. Settling the same
 * payment twice changes nothing, so a gateway may call back as often as it likes.
 */
async function settle(
  db: Database,
  deps: PaymentDeps,
  loaded: Loaded,
  settlement: Settlement,
): Promise<void> {
  const { payment, order, kitchen } = loaded;
  const { status, trx, now, random } = settlement;

  const paidTooLate = await db.transaction(async (tx) => {
    const claimed = await tx
      .update(payments)
      .set({ status, providerTrx: trx, completedAt: now })
      .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
      .returning({ id: payments.id });
    if (claimed.length === 0 || status !== 'paid') return false;

    // The clock for the promised arrival starts now, when the kitchen is told.
    const [started] = await tx
      .update(orders)
      .set({ awaitingPayment: false, paidAt: now, placedAt: now })
      .where(and(eq(orders.id, order.id), eq(orders.awaitingPayment, true)))
      .returning();
    if (started) {
      await startJourney(tx, { order: started, kitchen, now, random });
      return false;
    }

    // The order lapsed or was cancelled while the customer was paying.
    await tx
      .update(orders)
      .set({ paidAt: now })
      .where(and(eq(orders.id, order.id), isNull(orders.paidAt)));
    return true;
  });

  if (paidTooLate) {
    await refundOrder(db, deps, {
      orderId: order.id,
      amount: payment.amount,
      reason: order.cancelReason ?? SYSTEM_REASONS.paymentTimeout,
      byUserId: null,
      now,
    });
  }
}

const SANDBOX_STATUS = {
  approve: 'paid',
  decline: 'failed',
  cancel: 'cancelled',
} as const satisfies Record<SandboxOutcome, Settlement['status']>;

/** The test gateway's page reports what the visitor chose. */
export async function settleSandbox(
  db: Database,
  deps: PaymentDeps,
  input: { token: string; outcome: SandboxOutcome; now: Date; random: () => number },
): Promise<PaymentDto> {
  const { token, outcome, now, random } = input;

  const loaded = await loadPayment(db, eq(payments.token, token));
  if (!loaded || loaded.payment.provider !== 'sandbox') throw noSuchPayment();

  if (await lapseIfUnpaid(db, loaded.order, now)) return getPayment(db, token, now);
  if (loaded.payment.status !== 'pending') {
    throw new ApiError('payment_closed', 'This payment is already finished.', {
      status: loaded.payment.status,
    });
  }

  await settle(db, deps, loaded, {
    status: SANDBOX_STATUS[outcome],
    trx:
      outcome === 'approve'
        ? `SBX-${randomBytes(5).toString('hex').toUpperCase()}`
        : null,
    now,
    random,
  });
  return getPayment(db, token, now);
}

/**
 * bKash has sent the customer back. Their word that it worked is not taken: the
 * payment is completed by asking bKash, server to server.
 */
export async function settleBkash(
  db: Database,
  deps: PaymentDeps,
  input: { paymentId: string; status: string; now: Date; random: () => number },
): Promise<{ orderToken: string; locale: string }> {
  const { paymentId, now, random } = input;

  const loaded = await loadPayment(
    db,
    and(eq(payments.provider, 'bkash'), eq(payments.providerRef, paymentId)),
  );
  if (!loaded) throw noSuchPayment();
  const back = { orderToken: loaded.order.token, locale: loaded.order.locale };
  if (loaded.payment.status !== 'pending') return back;

  if (input.status !== 'success') {
    await settle(db, deps, loaded, {
      status: input.status === 'cancel' ? 'cancelled' : 'failed',
      trx: null,
      now,
      random,
    });
    return back;
  }

  let confirmed: { paid: boolean; trx: string | null };
  try {
    confirmed = await deps.gateways.byProvider('bkash').confirm(paymentId);
  } catch (error) {
    // Not knowing is not the same as failing. The payment stays open to be tried again.
    console.error(error);
    return back;
  }

  await settle(db, deps, loaded, {
    status: confirmed.paid ? 'paid' : 'failed',
    trx: confirmed.trx,
    now,
    random,
  });
  return back;
}

/** Starts a fresh payment for an order whose last attempt failed or was abandoned. */
export async function retryPayment(
  db: Database,
  deps: PaymentDeps,
  input: { orderToken: string; now: Date },
): Promise<OpenPayment> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.token, input.orderToken))
    .limit(1);
  if (!order) throw new ApiError('not_found', 'There is no order for this link.');

  if ((await lapseIfUnpaid(db, order, input.now)) || !order.awaitingPayment) {
    throw new ApiError('payment_closed', 'This order is no longer waiting for payment.');
  }
  return openPayment(db, deps, order, input.now);
}

export type RefundInput = {
  orderId: number;
  amount: Paisa;
  reason: string;
  /** The problem report this refund answers, if it answers one. */
  issueId?: number | null;
  /** The admin giving the refund. Null when it is automatic. */
  byUserId: number | null;
  now: Date;
};

/**
 * Gives money back, never more than was paid. The refund is written down first and
 * sent second: if the gateway then refuses, the record says so and a person sends the
 * money by hand, which is better than money sent with no record of it.
 */
export async function refundOrder(
  db: Database,
  deps: PaymentDeps,
  input: RefundInput,
): Promise<RefundRow> {
  const { orderId, amount, reason, byUserId, now } = input;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new ApiError('not_found', 'There is no such order.');

  const available = refundable({
    method: order.paymentMethod,
    status: await statusOf(db, order.id, now),
    awaitingPayment: order.awaitingPayment,
    paidOnline: order.paidAt !== null,
    total: order.total,
    refunded: order.refunded,
  });
  if (!Number.isInteger(amount) || amount < 1 || amount > available) {
    throw new ApiError('invalid_request', 'That is more than can be refunded.', {
      refundable: available,
    });
  }

  const [paid] = isOnline(order.paymentMethod)
    ? await db
        .select()
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.status, 'paid')))
        .limit(1)
    : [];

  const refund = await db.transaction(async (tx) => {
    // The amount is added only if nobody refunded in the meantime.
    const claimed = await tx
      .update(orders)
      .set({ refunded: sql`${orders.refunded} + ${amount}` })
      .where(and(eq(orders.id, order.id), eq(orders.refunded, order.refunded)))
      .returning({ id: orders.id });
    if (claimed.length === 0) {
      throw new ApiError(
        'invalid_request',
        'This order was refunded a moment ago. Reload.',
      );
    }

    const [created] = await tx
      .insert(refunds)
      .values({
        orderId: order.id,
        paymentId: paid?.id ?? null,
        amount,
        reason,
        issueId: input.issueId ?? null,
        byUserId,
        createdAt: now,
      })
      .returning();
    if (!created) throw new Error('The refund row was not created');
    return created;
  });

  // Cash is handed back by a person. Only an online payment has a gateway to send it.
  if (!paid) return refund;

  try {
    const sent = await deps.gateways.byProvider(paid.provider).refund({
      ref: paid.providerRef,
      trx: paid.providerTrx,
      amount,
      reason,
    });
    const [updated] = await db
      .update(refunds)
      .set({ providerRef: sent.ref })
      .where(eq(refunds.id, refund.id))
      .returning();
    return updated ?? refund;
  } catch (error) {
    console.error(error);
    const [updated] = await db
      .update(refunds)
      .set({ failed: true })
      .where(eq(refunds.id, refund.id))
      .returning();
    return updated ?? refund;
  }
}

/** Gives back everything that was paid, after an order is cancelled. */
export async function refundInFull(
  db: Database,
  deps: PaymentDeps,
  input: { orderId: number; reason: string; byUserId: number | null; now: Date },
): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);
  if (!order || order.paidAt === null) return;

  const amount = order.total - order.refunded;
  if (amount > 0) await refundOrder(db, deps, { ...input, amount });
}
