/**
 * Four weeks of finished orders, with the ratings and problem reports that came out of
 * them, so every screen has something to show on first start. They are made up, like
 * the kitchens, and are only seeded in demo mode. Everything is derived from hashes, so
 * the same history appears each time for a given starting moment.
 */
import { randomBytes } from 'node:crypto';
import {
  ORDER_STEPS,
  dhakaDayStart,
  isOpenAt,
  planTimeline,
  priceOrder,
  type Paisa,
} from '@unun/core';
import { asc, eq, sql } from 'drizzle-orm';
import type { Transaction } from '../db/client';
import {
  areas,
  issues,
  kitchens,
  menuItems,
  orderEvents,
  orderLines,
  orders,
  ratings,
  refunds,
  users,
} from '../db/schema';
import { deliveryTo } from '../modules/catalogue/service';
import { demoCustomerPhone, pastCustomerSeeds } from './accounts';
import { hash } from './build';
import { dishSeeds } from './dishes';
import { HABIT_PERCENT, goesWith } from './pairings';
import { commentsByStars, issueSeeds, lateComments } from './reviews';

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
const DAYS = 28;
/** Every seeded order was placed at least this long ago, so all of them are finished. */
const SETTLED_MINUTES = 3 * 60;

/** Roughly this share of delivered orders were rated, and this share of ratings say why. */
const RATED_PERCENT = 58;
const COMMENTED_PERCENT = 55;
/** Seeded problem reports are about orders this recent, so they can still be answered. */
const REPORTED_WITHIN_HOURS = 40;
const ROWS_PER_INSERT = 400;

const PUBLIC_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function publicIdFor(seed: number): string {
  let value = seed;
  let id = 'UN-';
  for (let index = 0; index < 6; index += 1) {
    id += PUBLIC_ID_ALPHABET[value % PUBLIC_ID_ALPHABET.length];
    value = Math.floor(value / PUBLIC_ID_ALPHABET.length) + 7919 * (index + 1);
  }
  return id;
}

/** A moment in the last week when the kitchen was open. */
function placedAtFor(
  key: string,
  hours: { opens: number; closes: number },
  now: Date,
): Date {
  const latest = now.getTime() - SETTLED_MINUTES * MINUTE_MS;
  const daysAgo = hash(`${key}:day`) % DAYS;
  const dayStart = dhakaDayStart(now).getTime() - daysAgo * DAY_MINUTES * MINUTE_MS;

  let minute = hash(`${key}:minute`) % DAY_MINUTES;
  if (!isOpenAt(hours.opens, hours.closes, minute)) {
    minute = (hours.opens + (hash(`${key}:after-opening`) % 180)) % DAY_MINUTES;
  }

  let placed = dayStart + minute * MINUTE_MS;
  while (placed > latest) placed -= DAY_MINUTES * MINUTE_MS;
  return new Date(placed);
}

const dishKeyByName = new Map(dishSeeds.map((dish) => [dish.en, dish.key]));

/** How many stars an invented customer gave. Late food is rated worse. */
function starsFor(key: string, late: boolean, onTimeOfTen: number): number {
  const roll = hash(`${key}:stars`) % 100;
  if (late) return roll < 15 ? 4 : roll < 55 ? 3 : roll < 85 ? 2 : 1;

  // A kitchen that keeps its promises is also the one people rate well.
  const lift = (onTimeOfTen - 7) * 5;
  if (roll < 48 + lift) return 5;
  if (roll < 82 + lift / 2) return 4;
  if (roll < 94) return 3;
  return roll < 98 ? 2 : 1;
}

function commentFor(key: string, stars: number, late: boolean): string | null {
  if (hash(`${key}:says`) % 100 >= COMMENTED_PERCENT) return null;
  const pool = (late ? lateComments[stars] : null) ?? commentsByStars[stars] ?? [];
  return pool[hash(`${key}:comment`) % pool.length] ?? null;
}

async function insertInChunks<Row>(
  rows: Row[],
  insert: (chunk: Row[]) => Promise<unknown>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += ROWS_PER_INSERT) {
    await insert(rows.slice(start, start + ROWS_PER_INSERT));
  }
}

export type HistoryOptions = {
  now: Date;
  serviceFee: Paisa;
  vatRate: number;
  /** Phones of the riders who delivered for the kitchens that are run by hand. */
  riderPhones: string[];
};

export type HistorySummary = { orders: number; ratings: number; issues: number };

type PlannedOrder = {
  row: typeof orders.$inferInsert;
  lines: Array<Omit<typeof orderLines.$inferInsert, 'orderId'>>;
  events: Array<Omit<typeof orderEvents.$inferInsert, 'orderId'>>;
  rating: Omit<typeof ratings.$inferInsert, 'orderId'> | null;
  deliveredAt: Date;
  late: boolean;
};

/** Inserts the past orders and what customers said about them. */
export async function seedHistory(
  tx: Transaction,
  options: HistoryOptions,
): Promise<HistorySummary> {
  const { now, serviceFee, vatRate } = options;

  const [kitchenRows, itemRows, userRows] = await Promise.all([
    tx
      .select({ kitchen: kitchens, area: areas })
      .from(kitchens)
      .innerJoin(areas, eq(areas.id, kitchens.areaId))
      .orderBy(asc(kitchens.id)),
    tx.select().from(menuItems).orderBy(asc(menuItems.id)),
    tx.select().from(users).orderBy(asc(users.id)),
  ]);

  const orderedBefore = new Set([
    demoCustomerPhone,
    ...pastCustomerSeeds.map((seed) => seed.phone),
  ]);
  const customers = userRows.filter((user) => orderedBefore.has(user.phone));
  const riders = userRows.filter((user) => options.riderPhones.includes(user.phone));
  const admin = userRows.find((user) => user.role === 'admin');
  if (customers.length === 0) return { orders: 0, ratings: 0, issues: 0 };

  const usedIds = new Set<string>();
  const planned: PlannedOrder[] = [];

  for (const { kitchen, area } of kitchenRows) {
    const menu = itemRows.filter((item) => item.kitchenId === kitchen.id);
    const delivery = deliveryTo(kitchen, area);
    if (menu.length === 0 || !delivery) continue;

    // The dearer half of the dishes a kitchen is known for: its mains, not its drinks.
    const known = menu.filter((item) => item.popular).sort((x, y) => y.price - x.price);
    const mains = known.length > 0 ? known.slice(0, Math.ceil(known.length / 2)) : menu;

    // A kitchen with an owner at its screen was run by hand, with a real rider.
    const byHand = kitchen.ownerId !== null && riders.length > 0;
    const howMany = 6 + (hash(`${kitchen.slug}:orders`) % 13);

    for (let index = 0; index < howMany; index += 1) {
      const key = `${kitchen.slug}:${index}`;

      // Every order starts with a dish the kitchen is known for. The rest of the order
      // comes from anywhere on its menu.
      const main = mains[hash(`${key}:main`) % mains.length]!;
      const picked = new Map<number, number>([[main.id, 1]]);

      // Most extras are what people usually have with the main dish; the rest are chance.
      const companions = goesWith.get(dishKeyByName.get(main.nameEn) ?? '') ?? [];
      const usual = menu.filter((item) =>
        companions.includes(dishKeyByName.get(item.nameEn) ?? ''),
      );
      const extras = hash(`${key}:dishes`) % 4;
      for (let dish = 0; dish < extras; dish += 1) {
        const byHabit =
          usual.length > 0 && hash(`${key}:habit:${dish}`) % 100 < HABIT_PERCENT;
        const from = byHabit ? usual : menu;
        const item = from[hash(`${key}:dish:${dish}`) % from.length]!;
        picked.set(item.id, (picked.get(item.id) ?? 0) + 1);
      }

      const lines = [...picked].map(([itemId, quantity]) => {
        const item = menu.find((candidate) => candidate.id === itemId)!;
        return { item, quantity, unitPrice: item.price, total: item.price * quantity };
      });
      // A small order is topped up until it meets the kitchen's minimum.
      const first = lines[0]!;
      while (lines.reduce((sum, line) => sum + line.total, 0) < kitchen.minOrder) {
        first.quantity += 1;
        first.total += first.unitPrice;
      }

      const breakdown = priceOrder(lines, {
        deliveryFee: delivery.fee,
        serviceFee,
        vatRate,
      });

      const placedAt = placedAtFor(
        key,
        { opens: kitchen.opensMinute, closes: kitchen.closesMinute },
        now,
      );
      const late = hash(`${key}:late`) % 10 >= kitchen.onTimeOfTen;
      const timeline = planTimeline({
        prepMinutes: kitchen.prepMinutes,
        window: delivery.window,
        position: (hash(`${key}:position`) % 1000) / 1000,
        late,
      });
      const deliveredAt = new Date(placedAt.getTime() + timeline.delivered * MINUTE_MS);

      let publicId = publicIdFor(hash(`${key}:id`));
      while (usedIds.has(publicId)) publicId = publicIdFor(hash(`${publicId}:again`));
      usedIds.add(publicId);

      const customer = customers[hash(`${key}:customer`) % customers.length]!;
      const rider = byHand ? riders[hash(`${key}:rider`) % riders.length]! : null;

      let rating: PlannedOrder['rating'] = null;
      if (hash(`${key}:rated`) % 100 < RATED_PERCENT) {
        const stars = starsFor(key, late, kitchen.onTimeOfTen);
        const wroteAt =
          deliveredAt.getTime() + (15 + (hash(`${key}:wrote`) % 600)) * MINUTE_MS;
        rating = {
          kitchenId: kitchen.id,
          stars,
          comment: commentFor(key, stars, late),
          createdAt: new Date(Math.min(wroteAt, now.getTime() - MINUTE_MS)),
        };
      }

      planned.push({
        row: {
          publicId,
          token: randomBytes(18).toString('base64url'),
          kitchenId: kitchen.id,
          areaId: area.id,
          userId: customer.id,
          riderId: rider?.id ?? null,
          autopilot: !byHand,
          customerName: customer.name,
          customerPhone: customer.phone,
          address: `House ${1 + (hash(`${key}:house`) % 60)}, Road ${1 + (hash(`${key}:road`) % 30)}`,
          paymentMethod: 'cash',
          itemsTotal: breakdown.items,
          discount: breakdown.discount,
          deliveryFee: breakdown.delivery,
          deliveryDiscount: breakdown.deliveryDiscount,
          serviceFee: breakdown.service,
          vat: breakdown.vat,
          total: breakdown.total,
          windowMin: delivery.window.min,
          windowMax: delivery.window.max,
          timeScale: 1,
          placedAt,
        },
        lines: lines.map((line) => ({
          menuItemId: line.item.id,
          nameEn: line.item.nameEn,
          nameBn: line.item.nameBn,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          lineTotal: line.total,
        })),
        events: ORDER_STEPS.map((status) => ({
          status,
          minute: timeline[status],
          at: new Date(placedAt.getTime() + timeline[status] * MINUTE_MS),
        })),
        rating,
        deliveredAt,
        late,
      });
    }
  }

  // Orders go in first, a few hundred at a time; everything else needs their ids.
  const idOf = new Map<string, number>();
  await insertInChunks(planned, async (chunk) => {
    const inserted = await tx
      .insert(orders)
      .values(chunk.map((order) => order.row))
      .returning({ id: orders.id, publicId: orders.publicId });
    for (const row of inserted) idOf.set(row.publicId, row.id);
  });
  const orderId = (order: PlannedOrder): number => {
    const id = idOf.get(order.row.publicId);
    if (id === undefined) throw new Error('A past order was not inserted');
    return id;
  };

  await insertInChunks(
    planned.flatMap((order) =>
      order.lines.map((line) => ({ ...line, orderId: orderId(order) })),
    ),
    (chunk) => tx.insert(orderLines).values(chunk),
  );
  await insertInChunks(
    planned.flatMap((order) =>
      order.events.map((event) => ({ ...event, orderId: orderId(order) })),
    ),
    (chunk) => tx.insert(orderEvents).values(chunk),
  );

  const ratingRows = planned.flatMap((order) =>
    order.rating ? [{ ...order.rating, orderId: orderId(order) }] : [],
  );
  await insertInChunks(ratingRows, (chunk) => tx.insert(ratings).values(chunk));

  // A handful of problem reports on the newest orders: three waiting for an answer, one
  // that ended in a refund and one that was closed without.
  const reportable = planned
    .filter(
      (order) =>
        now.getTime() - order.deliveredAt.getTime() <
        REPORTED_WITHIN_HOURS * 60 * MINUTE_MS,
    )
    .sort((x, y) => y.deliveredAt.getTime() - x.deliveredAt.getTime());
  const reported = new Set<PlannedOrder>();
  let issuesMade = 0;

  for (const [index, seed] of issueSeeds.entries()) {
    // A report that the food was late belongs to an order that was.
    const order = reportable.find(
      (candidate) =>
        !reported.has(candidate) && candidate.late === (seed.kind === 'late'),
    );
    if (!order) continue;
    reported.add(order);

    const createdAt = new Date(
      Math.min(
        order.deliveredAt.getTime() + (20 + index * 11) * MINUTE_MS,
        now.getTime() - MINUTE_MS,
      ),
    );
    const answered = index >= 3;
    const dearest = Math.max(...order.lines.map((line) => line.unitPrice));
    const refund = index === 3 ? Math.min(dearest, order.row.total) : 0;

    const [issue] = await tx
      .insert(issues)
      .values({
        orderId: orderId(order),
        kind: seed.kind,
        detail: seed.detail,
        status: !answered ? 'open' : refund > 0 ? 'refunded' : 'closed',
        note: !answered
          ? null
          : refund > 0
            ? 'Sorry about that. The price of the dish has been sent back to you.'
            : 'The rider has been spoken to. The total on your screen is always the one to pay.',
        refund,
        resolvedBy: answered ? (admin?.id ?? null) : null,
        createdAt,
        resolvedAt: answered
          ? new Date(Math.min(createdAt.getTime() + 25 * MINUTE_MS, now.getTime()))
          : null,
      })
      .returning({ id: issues.id });
    if (!issue) throw new Error('A past problem report was not inserted');
    issuesMade += 1;

    if (refund > 0) {
      await tx.insert(refunds).values({
        orderId: orderId(order),
        issueId: issue.id,
        amount: refund,
        reason: 'Wrong dish sent',
        byUserId: admin?.id ?? null,
        createdAt: now,
      });
      await tx
        .update(orders)
        .set({ refunded: sql`${orders.refunded} + ${refund}` })
        .where(eq(orders.id, orderId(order)));
    }
  }

  return { orders: planned.length, ratings: ratingRows.length, issues: issuesMade };
}
