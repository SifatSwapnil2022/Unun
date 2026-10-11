/**
 * Orders: placing one and reading it back.
 *
 * A kitchen is either on autopilot or run by hand. On autopilot nobody is at its
 * screen, so the demo simulator plans the order's whole journey when it is placed and
 * stores each state with the moment it is reached. By hand, only "placed" is stored;
 * the kitchen's staff and a rider add the rest (see progress.ts).
 */
import { randomBytes, randomInt } from 'node:crypto';
import { isOnline, normaliseMobile } from '@unun/core';
import type {
  OrderCreated,
  OrderDto,
  OrderRequest,
  OrderSummaryDto,
} from '@unun/core/contracts';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { orderLines, orders } from '../../db/schema';
import { ApiError } from '../../http/errors';
import type { CatalogueDeps } from '../catalogue/service';
import {
  findOpenPayment,
  lapseIfUnpaid,
  openPayment,
  type PaymentDeps,
} from '../payments/service';
import { startJourney } from './journey';
import { buildQuote } from './quote';
import { feedbackFields, feedbackOf } from '../feedback/service';
import { loadOrders, toOrderDto, toOrderSummary, type OrderRow } from './read';

/** Letters and digits that cannot be mistaken for each other when read aloud. */
const PUBLIC_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function newPublicId(): string {
  let id = 'UN-';
  for (let index = 0; index < 6; index += 1) {
    id += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  }
  return id;
}

const newToken = () => randomBytes(18).toString('base64url');

async function findByIdempotencyKey(
  db: Database,
  key: string,
): Promise<OrderCreated | null> {
  const [existing] = await db
    .select({ id: orders.id, publicId: orders.publicId, token: orders.token })
    .from(orders)
    .where(eq(orders.idempotencyKey, key))
    .limit(1);
  if (!existing) return null;

  const open = await findOpenPayment(db, existing.id);
  return {
    publicId: existing.publicId,
    token: existing.token,
    payment: open ? { token: open.token, url: open.redirectUrl } : null,
  };
}

export type PlaceOrderInput = {
  request: OrderRequest;
  /** The signed-in customer, if there is one. */
  userId: number | null;
  idempotencyKey: string | null;
  now: Date;
  /** A number in [0, 1). Injected so tests can decide where an order lands. */
  random: () => number;
};

export async function placeOrder(
  db: Database,
  deps: PaymentDeps & CatalogueDeps,
  input: PlaceOrderInput,
): Promise<OrderCreated> {
  const { request, userId, idempotencyKey, now, random } = input;

  if (idempotencyKey) {
    const existing = await findByIdempotencyKey(db, idempotencyKey);
    if (existing) return existing;
  }

  const phone = normaliseMobile(request.customer.phone);
  if (!phone) {
    throw new ApiError(
      'invalid_phone',
      'Enter a Bangladeshi mobile number, for example 01712345678.',
    );
  }

  const online = isOnline(request.paymentMethod);
  // Fails here, before anything is stored, if this way of paying is not on offer.
  if (online) deps.gateways.forMethod(request.paymentMethod);

  const { quote, kitchen, area, appliedCode } = await buildQuote(
    db,
    deps,
    { ...request, phone },
    now,
  );

  if (!quote.kitchen.isOpen) {
    throw new ApiError('kitchen_closed', `${kitchen.nameEn} is closed right now.`);
  }
  if (!quote.meetsMinimum) {
    throw new ApiError(
      'below_minimum',
      `${kitchen.nameEn} needs a larger order than this.`,
      { minOrder: kitchen.minOrder },
    );
  }
  if (quote.promotion && !quote.promotion.applied) {
    throw new ApiError(
      'promotion_refused',
      `The code ${quote.promotion.code} cannot be used on this order.`,
      { reason: quote.promotion.reason },
    );
  }
  if (quote.breakdown.total !== request.expectedTotal) {
    // The customer was shown a different total. Refuse, and send the current quote back.
    throw new ApiError(
      'price_changed',
      'The total has changed since it was shown. Please check the new total.',
      { quote },
    );
  }

  const ids = { publicId: newPublicId(), token: newToken() };

  const store = db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        ...ids,
        idempotencyKey,
        kitchenId: kitchen.id,
        areaId: area.id,
        userId,
        autopilot: kitchen.autopilot,
        // An order paid online waits, unseen by the kitchen, until the money arrives.
        awaitingPayment: online,
        locale: request.locale ?? 'en',
        customerName: request.customer.name,
        customerPhone: phone,
        address: request.address,
        note: request.note || null,
        paymentMethod: request.paymentMethod,
        promoCode: appliedCode,
        itemsTotal: quote.breakdown.items,
        discount: quote.breakdown.discount,
        deliveryFee: quote.breakdown.delivery,
        deliveryDiscount: quote.breakdown.deliveryDiscount,
        serviceFee: quote.breakdown.service,
        vat: quote.breakdown.vat,
        total: quote.breakdown.total,
        windowMin: quote.window.min,
        windowMax: quote.window.max,
        // Orders handled by people run in real time. Only the simulator is sped up.
        timeScale: kitchen.autopilot ? deps.config.demoSpeed : 1,
        placedAt: now,
      })
      .returning();
    if (!order) throw new Error('The order row was not created');

    await tx.insert(orderLines).values(
      quote.lines.map((line) => ({
        orderId: order.id,
        menuItemId: line.itemId,
        nameEn: line.name.en,
        nameBn: line.name.bn,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.total,
      })),
    );

    if (!online) await startJourney(tx, { order, kitchen, now, random });
    return order;
  });

  let order: OrderRow;
  try {
    order = await store;
  } catch (error) {
    // Two requests with the same key can race. The loser returns the winner's order.
    const winner = idempotencyKey ? await findByIdempotencyKey(db, idempotencyKey) : null;
    if (winner) return winner;
    throw error;
  }

  if (!online) return { ...ids, payment: null };

  try {
    return { ...ids, payment: await openPayment(db, deps, order, now) };
  } catch (error) {
    // No payment could be opened, so the order can never start. Nobody has seen it yet.
    await db.delete(orders).where(eq(orders.id, order.id));
    throw error;
  }
}

/** The order behind a tracking link. Whoever holds the link may read it. */
export async function getOrder(
  db: Database,
  token: string,
  now: Date,
): Promise<OrderDto> {
  const load = async () =>
    (await loadOrders(db, now, { where: eq(orders.token, token), limit: 1 }))[0];

  let view = await load();
  if (!view) throw new ApiError('not_found', 'There is no order for this link.');

  // Reading an unpaid order after its window has closed is what closes it.
  if (await lapseIfUnpaid(db, view.order, now)) view = (await load()) ?? view;

  const open = view.order.awaitingPayment
    ? await findOpenPayment(db, view.order.id)
    : null;
  return toOrderDto(view, {
    now,
    openPayment: open,
    feedback: feedbackFields(view, await feedbackOf(db, view.order.id), now),
  });
}

/** A customer's own orders, newest first. */
export async function listOrdersOf(
  db: Database,
  userId: number,
  now: Date,
): Promise<OrderSummaryDto[]> {
  const views = await loadOrders(db, now, {
    where: eq(orders.userId, userId),
    newestFirst: true,
    limit: 40,
  });
  return views.map(toOrderSummary);
}
