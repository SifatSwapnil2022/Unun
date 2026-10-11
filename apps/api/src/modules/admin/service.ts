/**
 * The admin workspace: what is happening across the platform, and the few controls
 * support staff need over orders, kitchens and people.
 */
import {
  USER_ROLES,
  arrivalOutcome,
  dhakaDate,
  dhakaDayStart,
  normaliseMobile,
  type UserRole,
} from '@unun/core';
import type {
  AdminKitchenDto,
  AdminKitchenUpdate,
  AdminOrders,
  AdminOverview,
  AdminUserDto,
  OrderTotals,
} from '@unun/core/contracts';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  type SQL,
} from 'drizzle-orm';
import type { Database } from '../../db/client';
import { areas, kitchens, orders, users } from '../../db/schema';
import { ApiError } from '../../http/errors';
import { toUserDto } from '../auth/service';
import { countOpenIssues } from '../feedback/service';
import {
  confirmed,
  finished,
  inProgress,
  loadOrders,
  toWorkOrder,
  type OrderView,
} from '../orders/read';

const DAY_MS = 24 * 60 * 60_000;
const DAYS_SHOWN = 7;

function totalsOf(views: OrderView[]): OrderTotals {
  const delivered = views.filter((view) => view.status === 'delivered');
  return {
    orders: views.length,
    delivered: delivered.length,
    cancelled: views.filter((view) => view.status === 'cancelled').length,
    sales: delivered.reduce((sum, view) => sum + view.order.total, 0),
  };
}

export async function getOverview(db: Database, now: Date): Promise<AdminOverview> {
  const today = dhakaDayStart(now);
  const weekStart = new Date(today.getTime() - (DAYS_SHOWN - 1) * DAY_MS);

  const [week, live, kitchenRows, people, openIssues] = await Promise.all([
    // A week of orders is small enough to add up here. At scale these figures would
    // come from a reporting table that is updated as orders finish.
    loadOrders(db, now, {
      // An order still waiting for its payment is not yet an order to count.
      where: and(confirmed, gte(orders.placedAt, weekStart)),
      limit: 20_000,
    }),
    db.select({ total: count() }).from(orders).where(inProgress(db, now)),
    db
      .select({
        active: kitchens.active,
        paused: kitchens.paused,
        autopilot: kitchens.autopilot,
      })
      .from(kitchens),
    db.select({ role: users.role, total: count() }).from(users).groupBy(users.role),
    countOpenIssues(db),
  ]);

  const delivered = week.filter((view) => view.status === 'delivered');
  const notLate = delivered.filter((view) => {
    const event = view.events.find((candidate) => candidate.status === 'delivered');
    const { windowMin: min, windowMax: max } = view.order;
    return event !== undefined && arrivalOutcome(event.minute, { min, max }) !== 'late';
  });

  const days = Array.from({ length: DAYS_SHOWN }, (_, index) => {
    const start = weekStart.getTime() + index * DAY_MS;
    const ofDay = week.filter((view) => {
      const placed = view.order.placedAt.getTime();
      return placed >= start && placed < start + DAY_MS;
    });
    const totals = totalsOf(ofDay);
    return {
      date: dhakaDate(new Date(start)),
      orders: totals.orders,
      sales: totals.sales,
    };
  });

  return {
    today: totalsOf(
      week.filter((view) => view.order.placedAt.getTime() >= today.getTime()),
    ),
    week: {
      ...totalsOf(week),
      onTimeShare: delivered.length === 0 ? null : notLate.length / delivered.length,
    },
    inProgress: live[0]?.total ?? 0,
    openIssues,
    kitchens: {
      total: kitchenRows.length,
      hidden: kitchenRows.filter((kitchen) => !kitchen.active).length,
      paused: kitchenRows.filter((kitchen) => kitchen.paused).length,
      byHand: kitchenRows.filter((kitchen) => !kitchen.autopilot).length,
    },
    people: Object.fromEntries(
      USER_ROLES.map((role) => [
        role,
        people.find((row) => row.role === role)?.total ?? 0,
      ]),
    ) as Record<UserRole, number>,
    days,
  };
}

export const ORDER_SCOPES = ['all', 'in_progress', 'finished'] as const;
export type OrderScope = (typeof ORDER_SCOPES)[number];

const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

export async function listOrders(
  db: Database,
  input: { scope: OrderScope; query: string | undefined; now: Date },
): Promise<AdminOrders> {
  const { scope, query, now } = input;
  const conditions: SQL[] = [];

  if (scope === 'in_progress') conditions.push(inProgress(db, now));
  if (scope === 'finished') conditions.push(finished(db, now));

  const text = query?.trim();
  if (text) {
    const pattern = likePattern(text);
    const phone = normaliseMobile(text);
    const matches = or(
      ilike(orders.publicId, pattern),
      ilike(orders.customerName, pattern),
      phone ? eq(orders.customerPhone, phone) : undefined,
      inArray(
        orders.kitchenId,
        db
          .select({ id: kitchens.id })
          .from(kitchens)
          .where(or(ilike(kitchens.nameEn, pattern), ilike(kitchens.nameBn, pattern))),
      ),
    );
    if (matches) conditions.push(matches);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [views, total] = await Promise.all([
    loadOrders(db, now, { where, newestFirst: true, limit: 60 }),
    db.select({ total: count() }).from(orders).where(where),
  ]);

  return {
    total: total[0]?.total ?? 0,
    orders: views.map((view) => ({
      ...toWorkOrder(view, { showPhone: true }),
      token: view.order.token,
    })),
  };
}

export async function listKitchens(db: Database, now: Date): Promise<AdminKitchenDto[]> {
  const weekStart = new Date(dhakaDayStart(now).getTime() - (DAYS_SHOWN - 1) * DAY_MS);

  const [rows, counts] = await Promise.all([
    db
      .select({ kitchen: kitchens, area: areas, owner: users })
      .from(kitchens)
      .innerJoin(areas, eq(areas.id, kitchens.areaId))
      .leftJoin(users, eq(users.id, kitchens.ownerId))
      .orderBy(asc(kitchens.nameEn)),
    db
      .select({ kitchenId: orders.kitchenId, total: count() })
      .from(orders)
      .where(gte(orders.placedAt, weekStart))
      .groupBy(orders.kitchenId),
  ]);

  const ordersByKitchen = new Map(counts.map((row) => [row.kitchenId, row.total]));

  return rows.map(({ kitchen, area, owner }) => ({
    slug: kitchen.slug,
    name: { en: kitchen.nameEn, bn: kitchen.nameBn },
    area: { en: area.nameEn, bn: area.nameBn },
    active: kitchen.active,
    paused: kitchen.paused,
    autopilot: kitchen.autopilot,
    owner: owner ? { id: owner.id, name: owner.name, phone: owner.phone } : null,
    ordersThisWeek: ordersByKitchen.get(kitchen.id) ?? 0,
  }));
}

export async function updateKitchen(
  db: Database,
  input: { slug: string; update: AdminKitchenUpdate; now: Date },
): Promise<AdminKitchenDto[]> {
  const { slug, update, now } = input;

  if (update.ownerId) {
    const [owner] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, update.ownerId))
      .limit(1);
    if (owner?.role !== 'owner') {
      throw new ApiError(
        'invalid_request',
        'Only a person with the owner role can run a kitchen.',
      );
    }
  }

  const changed = await db
    .update(kitchens)
    .set(update)
    .where(eq(kitchens.slug, slug))
    .returning({ id: kitchens.id });
  if (changed.length === 0) {
    throw new ApiError('not_found', `There is no kitchen "${slug}".`);
  }

  return listKitchens(db, now);
}

export async function listUsers(
  db: Database,
  input: { role: UserRole | undefined; query: string | undefined },
): Promise<AdminUserDto[]> {
  const conditions: SQL[] = [];
  if (input.role) conditions.push(eq(users.role, input.role));

  const text = input.query?.trim();
  if (text) {
    const phone = normaliseMobile(text);
    const matches = or(
      ilike(users.name, likePattern(text)),
      ilike(users.phone, likePattern(text)),
      phone ? eq(users.phone, phone) : undefined,
    );
    if (matches) conditions.push(matches);
  }

  const rows = await db
    .select()
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(200);
  if (rows.length === 0) return [];

  const ids = rows.map((user) => user.id);
  const [orderCounts, owned] = await Promise.all([
    db
      .select({ userId: orders.userId, total: count() })
      .from(orders)
      .where(inArray(orders.userId, ids))
      .groupBy(orders.userId),
    db
      .select({ ownerId: kitchens.ownerId, nameEn: kitchens.nameEn })
      .from(kitchens)
      .where(inArray(kitchens.ownerId, ids))
      .orderBy(asc(kitchens.nameEn)),
  ]);

  return rows.map((user) => ({
    ...toUserDto(user),
    joinedAt: user.createdAt.toISOString(),
    orders: orderCounts.find((row) => row.userId === user.id)?.total ?? 0,
    kitchens: owned.filter((row) => row.ownerId === user.id).map((row) => row.nameEn),
  }));
}

/**
 * Gives a person another role. An admin cannot change their own. The role is read from
 * the database on every request, so the change applies to sessions already open.
 */
export async function changeRole(
  db: Database,
  input: { adminId: number; userId: number; role: UserRole },
): Promise<AdminUserDto> {
  const { adminId, userId, role } = input;
  if (adminId === userId) {
    throw new ApiError(
      'forbidden',
      'You cannot change your own role. Ask another admin to do it.',
    );
  }

  const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!current) throw new ApiError('not_found', 'There is no such person.');

  if (current.role !== role) {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ role }).where(eq(users.id, userId));
      // A person who stops being an owner no longer runs any kitchen.
      if (current.role === 'owner') {
        await tx
          .update(kitchens)
          .set({ ownerId: null })
          .where(eq(kitchens.ownerId, userId));
      }
    });
  }

  const [updated] = await listUsers(db, { role: undefined, query: current.phone });
  if (!updated) throw new ApiError('not_found', 'There is no such person.');
  return updated;
}
