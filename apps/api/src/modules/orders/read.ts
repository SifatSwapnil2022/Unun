/**
 * Reading orders. An order's state is not a column: it is the latest event whose
 * moment has passed. That lets the simulator store an autopilot order's whole journey
 * when it is placed, and lets staff add events one at a time for the rest. Everything
 * that needs an order's state reads it through this file.
 */
import {
  arrivalOutcome,
  cashToCollect,
  firstName,
  maskMobile,
  paymentState,
  PAYMENT_WINDOW_MINUTES,
  pointBetween,
  rideMinutes,
  type ArrivalOutcome,
  type LatLng,
  type OrderStatus,
  type PaymentFacts,
} from '@unun/core';
import type {
  OrderDto,
  OrderMapDto,
  OrderSummaryDto,
  WorkOrderDto,
} from '@unun/core/contracts';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  inArray,
  lte,
  notExists,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  areas,
  kitchens,
  orderEvents,
  orderLines,
  orders,
  payments,
  users,
} from '../../db/schema';

export type OrderRow = typeof orders.$inferSelect;
type KitchenRow = typeof kitchens.$inferSelect;
type AreaRow = typeof areas.$inferSelect;
type LineRow = typeof orderLines.$inferSelect;
type EventRow = typeof orderEvents.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

const MINUTE_MS = 60_000;
const ENDINGS: OrderStatus[] = ['delivered', 'cancelled'];

/** A database or a transaction: reads work the same on both. */
export type Reader = Pick<Database, 'select'>;

/** An order with everything needed to show it, and its state at one moment. */
export type OrderView = {
  order: OrderRow;
  kitchen: KitchenRow;
  /** Where the kitchen is. */
  kitchenArea: AreaRow | null;
  /** Where the food is going. */
  area: AreaRow;
  lines: LineRow[];
  /** Events whose moment has passed, oldest first. */
  events: EventRow[];
  /** When the simulator will deliver the order, if that is planned and still ahead. */
  deliveryPlannedAt: Date | null;
  status: OrderStatus;
  riderName: string | null;
};

const ended = (db: Reader, now: Date) =>
  db
    .select({ one: sql`1` })
    .from(orderEvents)
    .where(
      and(
        eq(orderEvents.orderId, orders.id),
        inArray(orderEvents.status, ENDINGS),
        lte(orderEvents.at, now),
      ),
    );

/**
 * Matches orders that are neither delivered nor cancelled at `now`. An order still
 * waiting for its online payment is not in progress: the kitchen has not been told.
 */
export const inProgress = (db: Reader, now: Date): SQL =>
  and(eq(orders.awaitingPayment, false), notExists(ended(db, now))) as SQL;

/** Matches orders the kitchen has been told about: every order except an unpaid one. */
export const confirmed: SQL = eq(orders.awaitingPayment, false);

/** Matches orders that are delivered or cancelled at `now`. */
export const finished = (db: Reader, now: Date): SQL => exists(ended(db, now));

export async function loadOrders(
  db: Reader,
  now: Date,
  options: { where?: SQL; newestFirst?: boolean; limit?: number },
): Promise<OrderView[]> {
  const rows = await db
    .select({ order: orders, kitchen: kitchens, area: areas })
    .from(orders)
    .innerJoin(kitchens, eq(kitchens.id, orders.kitchenId))
    .innerJoin(areas, eq(areas.id, orders.areaId))
    .where(options.where)
    .orderBy(
      ...(options.newestFirst
        ? [desc(orders.placedAt), desc(orders.id)]
        : [asc(orders.placedAt), asc(orders.id)]),
    )
    .limit(options.limit ?? 50);
  if (rows.length === 0) return [];

  const orderIds = rows.map((row) => row.order.id);
  const riderIds = [...new Set(rows.flatMap((row) => row.order.riderId ?? []))];

  const [lines, events, planned, allAreas, riders] = await Promise.all([
    db
      .select()
      .from(orderLines)
      .where(inArray(orderLines.orderId, orderIds))
      .orderBy(asc(orderLines.id)),
    db
      .select()
      .from(orderEvents)
      .where(and(inArray(orderEvents.orderId, orderIds), lte(orderEvents.at, now)))
      .orderBy(asc(orderEvents.at), asc(orderEvents.id)),
    db
      .select({ orderId: orderEvents.orderId, at: orderEvents.at })
      .from(orderEvents)
      .where(
        and(
          inArray(orderEvents.orderId, orderIds),
          eq(orderEvents.status, 'delivered'),
          gt(orderEvents.at, now),
        ),
      ),
    db.select().from(areas),
    riderIds.length === 0
      ? []
      : db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, riderIds)),
  ]);

  const areasById = new Map(allAreas.map((area) => [area.id, area]));
  const riderNames = new Map(riders.map((rider) => [rider.id, rider.name]));
  const plannedDelivery = new Map(planned.map((event) => [event.orderId, event.at]));

  return rows.map(({ order, kitchen, area }) => {
    const reached = events.filter((event) => event.orderId === order.id);
    return {
      order,
      kitchen,
      kitchenArea: areasById.get(kitchen.areaId) ?? null,
      area,
      lines: lines.filter((line) => line.orderId === order.id),
      events: reached,
      deliveryPlannedAt: plannedDelivery.get(order.id) ?? null,
      status: reached.at(-1)?.status ?? 'placed',
      riderName: order.riderId === null ? null : (riderNames.get(order.riderId) ?? null),
    };
  });
}

/** The state of one order at `now`. */
export async function statusOf(
  db: Reader,
  orderId: number,
  now: Date,
): Promise<OrderStatus> {
  const [latest] = await db
    .select({ status: orderEvents.status })
    .from(orderEvents)
    .where(and(eq(orderEvents.orderId, orderId), lte(orderEvents.at, now)))
    .orderBy(desc(orderEvents.at), desc(orderEvents.id))
    .limit(1);
  return latest?.status ?? 'placed';
}

const addMinutes = (instant: Date, minutes: number) =>
  new Date(instant.getTime() + minutes * MINUTE_MS);

const nameOf = (row: { nameEn: string; nameBn: string } | null) => ({
  en: row?.nameEn ?? '',
  bn: row?.nameBn ?? '',
});

function arrivalOf(view: OrderView): ArrivalOutcome | null {
  const delivered = view.events.find((event) => event.status === 'delivered');
  return delivered
    ? arrivalOutcome(delivered.minute, {
        min: view.order.windowMin,
        max: view.order.windowMax,
      })
    : null;
}

/** How the order's money stands. */
export function paymentFacts(view: OrderView): PaymentFacts {
  const { order } = view;
  return {
    method: order.paymentMethod,
    status: view.status,
    awaitingPayment: order.awaitingPayment,
    paidOnline: order.paidAt !== null,
    total: order.total,
    refunded: order.refunded,
  };
}

const placeOf = (row: { lat: number; lng: number }): LatLng => ({
  lat: row.lat,
  lng: row.lng,
});

/** A rider's phone is trusted for this long after it last reported. */
const GPS_FRESH_MS = 3 * MINUTE_MS;

/**
 * Where the kitchen and the door are, and where the rider is once they have the food.
 * A phone's own position is used when it is fresh. Otherwise the position is worked
 * out: along the simulator's plan on autopilot, or from the time since pickup.
 */
function mapOf(view: OrderView, now: Date): OrderMapDto {
  const { order } = view;
  const kitchen = placeOf(view.kitchen);
  const destination = placeOf(view.area);
  const still: OrderMapDto = { kitchen, destination, rider: null, etaMinutes: null };

  const pickedUp = view.events.find((event) => event.status === 'picked_up');
  if (view.status !== 'picked_up' || !pickedUp) return still;

  const sinceMs = Math.max(now.getTime() - pickedUp.at.getTime(), 0);

  if (
    order.riderLat !== null &&
    order.riderLng !== null &&
    order.riderAt !== null &&
    now.getTime() - order.riderAt.getTime() <= GPS_FRESH_MS
  ) {
    const position = { lat: order.riderLat, lng: order.riderLng };
    return {
      ...still,
      rider: { position, source: 'gps' },
      etaMinutes: Math.max(Math.ceil(rideMinutes(position, destination)), 1),
    };
  }

  if (view.deliveryPlannedAt) {
    const rideMs = view.deliveryPlannedAt.getTime() - pickedUp.at.getTime();
    const leftMs = view.deliveryPlannedAt.getTime() - now.getTime();
    return {
      ...still,
      rider: {
        position: pointBetween(kitchen, destination, rideMs > 0 ? sinceMs / rideMs : 1),
        source: 'estimate',
      },
      // Order time, not wall-clock time: the simulator runs faster than real life.
      etaMinutes: Math.max(Math.ceil((leftMs * order.timeScale) / MINUTE_MS), 1),
    };
  }

  const ride = Math.max(rideMinutes(kitchen, destination), 2);
  const since = sinceMs / MINUTE_MS;
  return {
    ...still,
    rider: {
      // Without a signal the rider is never drawn at the door before they say so.
      position: pointBetween(kitchen, destination, Math.min(since / ride, 0.95)),
      source: 'estimate',
    },
    etaMinutes: Math.max(Math.ceil(ride - since), 1),
  };
}

/** The order as its customer sees it. */
export function toOrderDto(
  view: OrderView,
  extras: {
    now: Date;
    openPayment: PaymentRow | null;
    /** The rating and the problem reports, worked out by the feedback module. */
    feedback: Pick<OrderDto, 'rating' | 'canRate' | 'issues' | 'canReport'>;
  },
): OrderDto {
  const { order, kitchen, area } = view;
  const facts = paymentFacts(view);

  return {
    publicId: order.publicId,
    token: order.token,
    status: view.status,
    kitchen: {
      slug: kitchen.slug,
      name: nameOf(kitchen),
      area: nameOf(view.kitchenArea),
    },
    lines: view.lines.map((line) => ({
      itemId: line.menuItemId,
      name: nameOf(line),
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      total: line.lineTotal,
    })),
    breakdown: {
      items: order.itemsTotal,
      discount: order.discount,
      delivery: order.deliveryFee,
      deliveryDiscount: order.deliveryDiscount,
      service: order.serviceFee,
      vat: order.vat,
      total: order.total,
    },
    payment: {
      method: order.paymentMethod,
      state: paymentState(facts),
      refunded: order.refunded,
      payBy: order.awaitingPayment
        ? addMinutes(order.placedAt, PAYMENT_WINDOW_MINUTES).toISOString()
        : null,
      open: extras.openPayment
        ? { token: extras.openPayment.token, url: extras.openPayment.redirectUrl }
        : null,
    },
    map: mapOf(view, extras.now),
    customer: { name: order.customerName, phone: maskMobile(order.customerPhone) },
    deliverTo: { area: nameOf(area), address: order.address, note: order.note },
    promoCode: order.promoCode,
    placedAt: order.placedAt.toISOString(),
    promisedFrom: addMinutes(order.placedAt, order.windowMin).toISOString(),
    promisedTo: addMinutes(order.placedAt, order.windowMax).toISOString(),
    events: view.events.map((event) => ({
      status: event.status,
      // Reported in order time, so the timeline reads the same at any demo speed.
      at: addMinutes(order.placedAt, event.minute).toISOString(),
    })),
    arrival: arrivalOf(view),
    handledBy: order.autopilot ? 'autopilot' : 'people',
    rider: view.riderName ? { name: firstName(view.riderName) } : null,
    cancelReason: order.cancelReason,
    demoSpeed: order.timeScale,
    ...extras.feedback,
  };
}

/** One row of a customer's order history. */
export function toOrderSummary(view: OrderView): OrderSummaryDto {
  return {
    publicId: view.order.publicId,
    token: view.order.token,
    status: view.status,
    kitchen: { slug: view.kitchen.slug, name: nameOf(view.kitchen) },
    lines: view.lines.map((line) => ({ name: nameOf(line), quantity: line.quantity })),
    total: view.order.total,
    paymentState: paymentState(paymentFacts(view)),
    placedAt: view.order.placedAt.toISOString(),
  };
}

/**
 * The order as the people handling it see it. The customer's number is masked unless
 * the viewer needs it to reach them.
 */
export function toWorkOrder(
  view: OrderView,
  options: { showPhone: boolean },
): WorkOrderDto {
  const { order, kitchen } = view;

  return {
    publicId: order.publicId,
    status: view.status,
    handledBy: order.autopilot ? 'autopilot' : 'people',
    placedAt: order.placedAt.toISOString(),
    promisedTo: addMinutes(order.placedAt, order.windowMax).toISOString(),
    kitchen: {
      slug: kitchen.slug,
      name: nameOf(kitchen),
      address: { en: kitchen.addressEn, bn: kitchen.addressBn },
      area: nameOf(view.kitchenArea),
    },
    lines: view.lines.map((line) => ({ name: nameOf(line), quantity: line.quantity })),
    itemsTotal: order.itemsTotal,
    total: order.total,
    riderPay: order.deliveryFee,
    payment: {
      method: order.paymentMethod,
      state: paymentState(paymentFacts(view)),
      refunded: order.refunded,
    },
    collect: cashToCollect(order.paymentMethod, order.total),
    map: { kitchen: placeOf(kitchen), destination: placeOf(view.area) },
    customer: {
      name: order.customerName,
      phone: options.showPhone ? order.customerPhone : maskMobile(order.customerPhone),
    },
    deliverTo: { area: nameOf(view.area), address: order.address, note: order.note },
    rider: view.riderName ? { name: view.riderName } : null,
    cancelReason: order.cancelReason,
  };
}
