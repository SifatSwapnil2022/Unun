/**
 * What the Python service learns from: the catalogue it searches, and finished orders
 * without the people in them. No name, phone number, address or account id leaves the
 * API here. A dish is known by its English name, which every kitchen that cooks it shares.
 */
import { roadKm, type Localized } from '@unun/core';
import { and, asc, desc, eq, inArray, lte } from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  areas,
  cuisines,
  kitchenCuisines,
  kitchens,
  menuItems,
  orderEvents,
  orderLines,
  orders,
} from '../../db/schema';

export type MlCatalogue = {
  kitchens: Array<{
    slug: string;
    name: Localized;
    tagline: Localized;
    areaId: string;
    cuisines: Localized[];
    /** English names of every dish on the menu, and of the ones it is known for. */
    dishes: string[];
    popular: string[];
  }>;
  dishes: Array<{ name: Localized; description: Localized }>;
};

export type MlOrders = {
  orders: Array<{
    kitchen: string;
    /** English names of the dishes, each once. */
    dishes: string[];
    /** How many portions in all. */
    items: number;
    placedAt: string;
    prepMinutes: number;
    km: number;
    /** Minutes from placing to delivery. Null for an order that was not delivered. */
    minutes: number | null;
  }>;
};

export async function exportCatalogue(db: Database): Promise<MlCatalogue> {
  const [kitchenRows, cuisineRows, itemRows] = await Promise.all([
    db.select().from(kitchens).where(eq(kitchens.active, true)).orderBy(asc(kitchens.id)),
    db
      .select({
        kitchenId: kitchenCuisines.kitchenId,
        nameEn: cuisines.nameEn,
        nameBn: cuisines.nameBn,
      })
      .from(kitchenCuisines)
      .innerJoin(cuisines, eq(cuisines.id, kitchenCuisines.cuisineId))
      .orderBy(asc(kitchenCuisines.sort)),
    db.select().from(menuItems).orderBy(asc(menuItems.id)),
  ]);

  const dishes = new Map<string, MlCatalogue['dishes'][number]>();
  for (const item of itemRows) {
    if (dishes.has(item.nameEn)) continue;
    dishes.set(item.nameEn, {
      name: { en: item.nameEn, bn: item.nameBn },
      description: { en: item.descriptionEn, bn: item.descriptionBn },
    });
  }

  return {
    kitchens: kitchenRows.map((kitchen) => {
      const menu = itemRows.filter((item) => item.kitchenId === kitchen.id);
      return {
        slug: kitchen.slug,
        name: { en: kitchen.nameEn, bn: kitchen.nameBn },
        tagline: { en: kitchen.taglineEn, bn: kitchen.taglineBn },
        areaId: kitchen.areaId,
        cuisines: cuisineRows
          .filter((row) => row.kitchenId === kitchen.id)
          .map((row) => ({ en: row.nameEn, bn: row.nameBn })),
        dishes: menu.map((item) => item.nameEn),
        popular: menu.filter((item) => item.popular).map((item) => item.nameEn),
      };
    }),
    dishes: [...dishes.values()],
  };
}

/** The newest finished and unfinished orders the kitchens were told about. */
export async function exportOrders(
  db: Database,
  now: Date,
  limit = 20_000,
): Promise<MlOrders> {
  const rows = await db
    .select({
      id: orders.id,
      placedAt: orders.placedAt,
      slug: kitchens.slug,
      prepMinutes: kitchens.prepMinutes,
      kitchenLat: kitchens.lat,
      kitchenLng: kitchens.lng,
      areaLat: areas.lat,
      areaLng: areas.lng,
    })
    .from(orders)
    .innerJoin(kitchens, eq(kitchens.id, orders.kitchenId))
    .innerJoin(areas, eq(areas.id, orders.areaId))
    .where(eq(orders.awaitingPayment, false))
    .orderBy(desc(orders.placedAt), desc(orders.id))
    .limit(limit);
  if (rows.length === 0) return { orders: [] };

  const ids = rows.map((row) => row.id);
  const [lines, delivered] = await Promise.all([
    db
      .select({
        orderId: orderLines.orderId,
        nameEn: orderLines.nameEn,
        quantity: orderLines.quantity,
      })
      .from(orderLines)
      .where(inArray(orderLines.orderId, ids)),
    db
      .select({ orderId: orderEvents.orderId, minute: orderEvents.minute })
      .from(orderEvents)
      .where(
        and(
          inArray(orderEvents.orderId, ids),
          eq(orderEvents.status, 'delivered'),
          // The simulator plans a delivery ahead. Only one that has happened counts.
          lte(orderEvents.at, now),
        ),
      ),
  ]);

  const linesOf = new Map<number, typeof lines>();
  for (const line of lines) {
    const list = linesOf.get(line.orderId) ?? [];
    list.push(line);
    linesOf.set(line.orderId, list);
  }
  const minutesOf = new Map(delivered.map((event) => [event.orderId, event.minute]));

  return {
    orders: rows.map((row) => {
      const own = linesOf.get(row.id) ?? [];
      return {
        kitchen: row.slug,
        dishes: [...new Set(own.map((line) => line.nameEn))],
        items: own.reduce((sum, line) => sum + line.quantity, 0),
        placedAt: row.placedAt.toISOString(),
        prepMinutes: row.prepMinutes,
        km: roadKm(
          { lat: row.kitchenLat, lng: row.kitchenLng },
          { lat: row.areaLat, lng: row.areaLng },
        ),
        minutes: minutesOf.get(row.id) ?? null,
      };
    }),
  };
}
