/**
 * The restaurant owner's workspace: the order queue of a kitchen they run, the
 * switches that decide how it takes orders, and its menu.
 */
import { dhakaDayStart, sortAllergens, type Allergen, type ItemTag } from '@unun/core';
import type {
  ItemUpdate,
  KitchenSettings,
  MenuSectionDto,
  PartnerBoard,
  PartnerKitchenDto,
  PartnerMenu,
} from '@unun/core/contracts';
import { and, asc, eq, gte } from 'drizzle-orm';
import type { Config } from '../../config';
import type { Database } from '../../db/client';
import { areas, kitchens, menuItems, menuSections, orders } from '../../db/schema';
import { ApiError } from '../../http/errors';
import { isOpenNow, type KitchenRow } from '../catalogue/service';
import { ratingOfKitchen, reviewsOfKitchen } from '../feedback/service';
import { confirmed, finished, inProgress, loadOrders, toWorkOrder } from '../orders/read';

const notYours = () =>
  new ApiError('not_found', 'You do not run a kitchen with this name.');

async function ownedKitchens(db: Database, ownerId: number) {
  return db
    .select({ kitchen: kitchens, area: areas })
    .from(kitchens)
    .innerJoin(areas, eq(areas.id, kitchens.areaId))
    .where(eq(kitchens.ownerId, ownerId))
    .orderBy(asc(kitchens.nameEn));
}

type Owned = Awaited<ReturnType<typeof ownedKitchens>>[number];

function toKitchenDto(owned: Owned, config: Config, now: Date): PartnerKitchenDto {
  const { kitchen, area } = owned;
  return {
    slug: kitchen.slug,
    name: { en: kitchen.nameEn, bn: kitchen.nameBn },
    area: { en: area.nameEn, bn: area.nameBn },
    autopilot: kitchen.autopilot,
    paused: kitchen.paused,
    isOpen: isOpenNow(kitchen, config, now),
    hours: { opens: kitchen.opensMinute, closes: kitchen.closesMinute },
  };
}

export async function listOwnedKitchens(
  db: Database,
  config: Config,
  ownerId: number,
  now: Date,
): Promise<PartnerKitchenDto[]> {
  const owned = await ownedKitchens(db, ownerId);
  return owned.map((row) => toKitchenDto(row, config, now));
}

/** The kitchen with this slug, or the owner's first one when no slug is given. */
async function requireOwned(
  db: Database,
  ownerId: number,
  slug: string | undefined,
): Promise<Owned> {
  const owned = await ownedKitchens(db, ownerId);
  const match = slug ? owned.find((row) => row.kitchen.slug === slug) : owned[0];
  if (!match) throw notYours();
  return match;
}

export async function getBoard(
  db: Database,
  config: Config,
  input: { ownerId: number; slug: string | undefined; now: Date },
): Promise<PartnerBoard> {
  const { ownerId, slug, now } = input;
  const owned = await requireOwned(db, ownerId, slug);
  const ofKitchen = eq(orders.kitchenId, owned.kitchen.id);

  const [active, recent, today, rating, reviews] = await Promise.all([
    loadOrders(db, now, { where: and(ofKitchen, inProgress(db, now)), limit: 60 }),
    loadOrders(db, now, {
      where: and(ofKitchen, finished(db, now)),
      newestFirst: true,
      limit: 12,
    }),
    loadOrders(db, now, {
      where: and(ofKitchen, confirmed, gte(orders.placedAt, dhakaDayStart(now))),
      limit: 500,
    }),
    ratingOfKitchen(db, owned.kitchen.id),
    reviewsOfKitchen(db, owned.kitchen.id, { limit: 8, withComment: false }),
  ]);

  const kept = today.filter((view) => view.status !== 'cancelled');
  return {
    kitchen: toKitchenDto(owned, config, now),
    active: active.map((view) => toWorkOrder(view, { showPhone: false })),
    recent: recent.map((view) => toWorkOrder(view, { showPhone: false })),
    today: {
      orders: kept.length,
      sales: kept.reduce((sum, view) => sum + view.order.itemsTotal, 0),
    },
    rating,
    reviews,
  };
}

export async function updateSettings(
  db: Database,
  config: Config,
  input: { ownerId: number; slug: string; settings: KitchenSettings; now: Date },
): Promise<PartnerKitchenDto> {
  const { ownerId, slug, settings, now } = input;
  const owned = await requireOwned(db, ownerId, slug);

  const [kitchen] = await db
    .update(kitchens)
    .set(settings)
    .where(eq(kitchens.id, owned.kitchen.id))
    .returning();
  if (!kitchen) throw notYours();

  return toKitchenDto({ kitchen, area: owned.area }, config, now);
}

async function menuOf(db: Database, kitchen: KitchenRow): Promise<MenuSectionDto[]> {
  const [sections, items] = await Promise.all([
    db
      .select()
      .from(menuSections)
      .where(eq(menuSections.kitchenId, kitchen.id))
      .orderBy(asc(menuSections.sort)),
    db
      .select()
      .from(menuItems)
      .where(eq(menuItems.kitchenId, kitchen.id))
      .orderBy(asc(menuItems.sort)),
  ]);

  return sections.map((section) => ({
    id: section.id,
    name: { en: section.nameEn, bn: section.nameBn },
    items: items
      .filter((item) => item.sectionId === section.id)
      .map((item) => ({
        id: item.id,
        name: { en: item.nameEn, bn: item.nameBn },
        description: { en: item.descriptionEn, bn: item.descriptionBn },
        price: item.price,
        photo: item.photo,
        tags: item.tags as ItemTag[],
        allergens: item.allergens as Allergen[],
        popular: item.popular,
        available: item.available,
      })),
  }));
}

export async function getMenu(
  db: Database,
  input: { ownerId: number; slug: string | undefined },
): Promise<PartnerMenu> {
  const { kitchen } = await requireOwned(db, input.ownerId, input.slug);
  return {
    kitchen: { slug: kitchen.slug, name: { en: kitchen.nameEn, bn: kitchen.nameBn } },
    sections: await menuOf(db, kitchen),
  };
}

/**
 * Changes whether a dish can be ordered, its price, or what it contains. Returns the
 * kitchen's menu.
 */
export async function updateItem(
  db: Database,
  input: { ownerId: number; itemId: number; update: ItemUpdate },
): Promise<PartnerMenu> {
  const { ownerId, itemId, update } = input;

  const [row] = await db
    .select({ kitchen: kitchens })
    .from(menuItems)
    .innerJoin(kitchens, eq(kitchens.id, menuItems.kitchenId))
    .where(and(eq(menuItems.id, itemId), eq(kitchens.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new ApiError('not_found', 'There is no such dish on your menu.');

  await db
    .update(menuItems)
    .set({
      ...update,
      allergens: update.allergens ? sortAllergens(update.allergens) : undefined,
    })
    .where(eq(menuItems.id, itemId));

  return {
    kitchen: {
      slug: row.kitchen.slug,
      name: { en: row.kitchen.nameEn, bn: row.kitchen.nameBn },
    },
    sections: await menuOf(db, row.kitchen),
  };
}
