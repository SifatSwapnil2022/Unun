/**
 * Catalogue: areas, cuisines, kitchens, menus and advertised offers. Read-only.
 */
import {
  deliveryFeeFor,
  deliveryWindow,
  dhakaMinuteOfDay,
  isOpenAt,
  roadKm,
  type Allergen,
  type ItemTag,
  type KitchenTag,
} from '@unun/core';
import type {
  AreaDto,
  CuisineDto,
  KitchenDelivery,
  KitchenDetail,
  KitchenList,
  KitchenSummary,
  MenuSectionDto,
  OfferDto,
  RatingSummary,
} from '@unun/core/contracts';
import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Config } from '../../config';
import type { Database } from '../../db/client';
import {
  areas,
  cuisines,
  kitchenCuisines,
  kitchens,
  menuItems,
  menuSections,
  promotions,
} from '../../db/schema';
import { ApiError } from '../../http/errors';
import { ratingOfKitchen, ratingsByKitchen, reviewsForPage } from '../feedback/service';
import type { MlClient, SearchHit } from '../ml/client';
import { arrivalWindows } from '../ml/eta';

export type AreaRow = typeof areas.$inferSelect;
export type KitchenRow = typeof kitchens.$inferSelect;

export const KITCHEN_SORTS = ['fastest', 'fee', 'record', 'rating', 'relevance'] as const;
export type KitchenSort = (typeof KITCHEN_SORTS)[number];

/** What reading the catalogue needs besides the database. */
export type CatalogueDeps = { config: Config; ml: MlClient };

export type KitchenFilters = {
  areaId?: string;
  cuisineId?: string;
  query?: string;
  tag?: KitchenTag;
  sort?: KitchenSort;
};

const areaName = (area: AreaRow) => ({ en: area.nameEn, bn: area.nameBn });

/** Escapes the characters LIKE treats as wildcards, so a search for "50%" means that. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

export async function listAreas(db: Database): Promise<AreaDto[]> {
  const rows = await db.select().from(areas).orderBy(asc(areas.sort));
  return rows.map((area) => ({
    id: area.id,
    name: areaName(area),
    aliases: area.aliases,
  }));
}

export async function findArea(db: Database, id: string): Promise<AreaRow | null> {
  const [area] = await db.select().from(areas).where(eq(areas.id, id)).limit(1);
  return area ?? null;
}

async function requireArea(db: Database, id: string): Promise<AreaRow> {
  const area = await findArea(db, id);
  if (!area) throw new ApiError('unknown_area', `There is no delivery area "${id}".`);
  return area;
}

export async function listCuisines(db: Database): Promise<CuisineDto[]> {
  const rows = await db
    .select({
      id: cuisines.id,
      nameEn: cuisines.nameEn,
      nameBn: cuisines.nameBn,
      tone: cuisines.tone,
      photo: cuisines.photo,
      kitchens: count(kitchenCuisines.kitchenId),
    })
    .from(cuisines)
    .leftJoin(kitchenCuisines, eq(kitchenCuisines.cuisineId, cuisines.id))
    .groupBy(cuisines.id)
    .orderBy(asc(cuisines.sort));

  return rows.map((row) => ({
    id: row.id,
    name: { en: row.nameEn, bn: row.nameBn },
    tone: row.tone,
    photo: row.photo,
    kitchens: row.kitchens,
  }));
}

type CuisineRef = KitchenSummary['cuisines'][number];

/** The cuisines of several kitchens, fetched in one query. */
export async function cuisinesByKitchen(
  db: Database,
  kitchenIds: number[],
): Promise<Map<number, CuisineRef[]>> {
  const result = new Map<number, CuisineRef[]>();
  if (kitchenIds.length === 0) return result;

  const rows = await db
    .select({
      kitchenId: kitchenCuisines.kitchenId,
      id: cuisines.id,
      nameEn: cuisines.nameEn,
      nameBn: cuisines.nameBn,
    })
    .from(kitchenCuisines)
    .innerJoin(cuisines, eq(cuisines.id, kitchenCuisines.cuisineId))
    .where(inArray(kitchenCuisines.kitchenId, kitchenIds))
    .orderBy(asc(kitchenCuisines.sort));

  for (const row of rows) {
    const list = result.get(row.kitchenId) ?? [];
    list.push({ id: row.id, name: { en: row.nameEn, bn: row.nameBn } });
    result.set(row.kitchenId, list);
  }
  return result;
}

/** Distance, fee and arrival window from a kitchen to an area, or null if out of range. */
export function deliveryTo(kitchen: KitchenRow, area: AreaRow): KitchenDelivery | null {
  const km = roadKm(
    { lat: kitchen.lat, lng: kitchen.lng },
    { lat: area.lat, lng: area.lng },
  );
  const fee = deliveryFeeFor(km);
  if (fee === null) return null;

  return {
    areaId: area.id,
    km,
    fee,
    window: deliveryWindow(kitchen.prepMinutes, km),
    // The plain rule. arrivalWindows() replaces it when the model has an answer.
    estimate: 'formula',
  };
}

/** Whether customers can order now: inside opening hours, and not paused by its owner. */
export function isOpenNow(kitchen: KitchenRow, config: Config, now: Date): boolean {
  if (kitchen.paused) return false;
  return (
    config.alwaysOpen ||
    isOpenAt(kitchen.opensMinute, kitchen.closesMinute, dhakaMinuteOfDay(now))
  );
}

function toSummary(
  kitchen: KitchenRow,
  ownArea: AreaRow,
  delivery: KitchenDelivery,
  cuisineRefs: CuisineRef[],
  rating: RatingSummary | undefined,
  config: Config,
  now: Date,
): KitchenSummary {
  return {
    slug: kitchen.slug,
    name: { en: kitchen.nameEn, bn: kitchen.nameBn },
    tagline: { en: kitchen.taglineEn, bn: kitchen.taglineBn },
    area: { id: ownArea.id, name: areaName(ownArea) },
    cuisines: cuisineRefs,
    tone: kitchen.tone,
    photo: kitchen.photo,
    profilePhoto: kitchen.profilePhoto,
    tags: kitchen.tags as KitchenTag[],
    onTimeOfTen: kitchen.onTimeOfTen,
    rating: rating ?? { average: null, count: 0 },
    minOrder: kitchen.minOrder,
    hours: { opens: kitchen.opensMinute, closes: kitchen.closesMinute },
    isOpen: isOpenNow(kitchen, config, now),
    delivery,
  };
}

const SORTERS: Record<
  Exclude<KitchenSort, 'relevance'>,
  (a: KitchenSummary, b: KitchenSummary) => number
> = {
  fastest: (a, b) => a.delivery.window.min - b.delivery.window.min,
  fee: (a, b) =>
    a.delivery.fee - b.delivery.fee || a.delivery.window.min - b.delivery.window.min,
  record: (a, b) =>
    b.onTimeOfTen - a.onTimeOfTen || a.delivery.window.min - b.delivery.window.min,
  // A kitchen nobody has rated yet goes after every kitchen somebody has.
  rating: (a, b) =>
    (b.rating.average ?? 0) - (a.rating.average ?? 0) || b.rating.count - a.rating.count,
};

/**
 * Kitchens that match the filters. With an area, only kitchens that deliver there are
 * returned and the figures are for that area. Without one, every kitchen is returned
 * with figures for an address in its own area.
 */
/** The dishes that matched a search, in both languages, for each kitchen that has some. */
async function matchedDishes(
  db: Database,
  hits: SearchHit[],
  kitchenRows: KitchenRow[],
): Promise<Map<number, Array<{ en: string; bn: string }>>> {
  const result = new Map<number, Array<{ en: string; bn: string }>>();
  const names = [...new Set(hits.flatMap((hit) => hit.dishes))];
  if (names.length === 0 || kitchenRows.length === 0) return result;

  const rows = await db
    .select({
      kitchenId: menuItems.kitchenId,
      nameEn: menuItems.nameEn,
      nameBn: menuItems.nameBn,
    })
    .from(menuItems)
    .where(
      and(
        inArray(
          menuItems.kitchenId,
          kitchenRows.map((kitchen) => kitchen.id),
        ),
        inArray(menuItems.nameEn, names),
      ),
    );

  const hitOf = new Map(hits.map((hit) => [hit.slug, hit]));
  for (const kitchen of kitchenRows) {
    // Kept in the order the search ranked them.
    const wanted = hitOf.get(kitchen.slug)?.dishes ?? [];
    const own = rows.filter((row) => row.kitchenId === kitchen.id);
    const matched = wanted.flatMap((name) => {
      const row = own.find((candidate) => candidate.nameEn === name);
      return row ? [{ en: row.nameEn, bn: row.nameBn }] : [];
    });
    if (matched.length > 0) result.set(kitchen.id, matched);
  }
  return result;
}

export async function listKitchens(
  db: Database,
  deps: CatalogueDeps,
  filters: KitchenFilters,
  now: Date,
): Promise<KitchenList> {
  const { config, ml } = deps;
  const target = filters.areaId ? await requireArea(db, filters.areaId) : null;

  const conditions: SQL[] = [eq(kitchens.active, true)];

  if (filters.cuisineId) {
    conditions.push(
      inArray(
        kitchens.id,
        db
          .select({ id: kitchenCuisines.kitchenId })
          .from(kitchenCuisines)
          .where(eq(kitchenCuisines.cuisineId, filters.cuisineId)),
      ),
    );
  }

  if (filters.tag) {
    conditions.push(sql`${filters.tag} = any(${kitchens.tags})`);
  }

  const query = filters.query?.trim();
  // The search service understands other spellings and both scripts. Without it the
  // letters are matched as typed.
  const hits = query ? await ml.search(query) : null;
  if (hits) {
    if (hits.length === 0) {
      return {
        area: target ? { id: target.id, name: areaName(target) } : null,
        total: 0,
        kitchens: [],
        search: 'model',
      };
    }
    conditions.push(
      inArray(
        kitchens.slug,
        hits.map((hit) => hit.slug),
      ),
    );
  } else if (query) {
    const pattern = likePattern(query);
    const matches = or(
      ilike(kitchens.nameEn, pattern),
      ilike(kitchens.nameBn, pattern),
      ilike(kitchens.taglineEn, pattern),
      ilike(kitchens.taglineBn, pattern),
      exists(
        db
          .select({ one: sql`1` })
          .from(menuItems)
          .where(
            and(
              eq(menuItems.kitchenId, kitchens.id),
              or(ilike(menuItems.nameEn, pattern), ilike(menuItems.nameBn, pattern)),
            ),
          ),
      ),
      exists(
        db
          .select({ one: sql`1` })
          .from(kitchenCuisines)
          .innerJoin(cuisines, eq(cuisines.id, kitchenCuisines.cuisineId))
          .where(
            and(
              eq(kitchenCuisines.kitchenId, kitchens.id),
              or(ilike(cuisines.nameEn, pattern), ilike(cuisines.nameBn, pattern)),
            ),
          ),
      ),
    );
    if (matches) conditions.push(matches);
  }

  const rows = await db
    .select({ kitchen: kitchens, area: areas })
    .from(kitchens)
    .innerJoin(areas, eq(areas.id, kitchens.areaId))
    .where(and(...conditions));

  // Kitchens that are too far for the area are dropped before anything is looked up.
  const inRange = rows.flatMap(({ kitchen, area }) => {
    const delivery = deliveryTo(kitchen, target ?? area);
    return delivery ? [{ kitchen, area, delivery }] : [];
  });

  const kitchenIds = inRange.map((row) => row.kitchen.id);
  const [cuisineRefs, ratingOf, etas, matched] = await Promise.all([
    cuisinesByKitchen(db, kitchenIds),
    ratingsByKitchen(db, kitchenIds),
    arrivalWindows(
      db,
      ml,
      inRange.map((row) => ({ kitchen: row.kitchen, km: row.delivery.km })),
      now,
    ),
    hits
      ? matchedDishes(
          db,
          hits,
          inRange.map((row) => row.kitchen),
        )
      : null,
  ]);

  const summaries = inRange.map(({ kitchen, area, delivery }, index): KitchenSummary => {
    const summary = toSummary(
      kitchen,
      area,
      { ...delivery, ...etas[index] },
      cuisineRefs.get(kitchen.id) ?? [],
      ratingOf.get(kitchen.id),
      config,
      now,
    );
    const dishes = matched?.get(kitchen.id);
    return dishes ? { ...summary, matched: dishes } : summary;
  });

  // A search is shown closest match first unless the customer chose another order.
  const sort = filters.sort ?? (hits ? 'relevance' : 'fastest');
  if (sort === 'relevance' && hits) {
    const rank = new Map(hits.map((hit, index) => [hit.slug, index]));
    summaries.sort((a, b) => (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0));
  } else {
    const by = SORTERS[sort === 'relevance' ? 'fastest' : sort];
    summaries.sort((a, b) => by(a, b) || a.slug.localeCompare(b.slug));
  }

  return {
    area: target ? { id: target.id, name: areaName(target) } : null,
    total: summaries.length,
    kitchens: summaries,
    search: hits ? 'model' : query ? 'basic' : null,
  };
}

export async function findKitchenRow(
  db: Database,
  slug: string,
): Promise<{ kitchen: KitchenRow; area: AreaRow } | null> {
  const [row] = await db
    .select({ kitchen: kitchens, area: areas })
    .from(kitchens)
    .innerJoin(areas, eq(areas.id, kitchens.areaId))
    .where(and(eq(kitchens.slug, slug), eq(kitchens.active, true)))
    .limit(1);
  return row ?? null;
}

/** One kitchen with its whole menu. Fails if the kitchen does not deliver to the area. */
export async function getKitchen(
  db: Database,
  deps: CatalogueDeps,
  slug: string,
  areaId: string | undefined,
  now: Date,
): Promise<KitchenDetail> {
  const { config, ml } = deps;
  const found = await findKitchenRow(db, slug);
  if (!found) throw new ApiError('not_found', `There is no kitchen "${slug}".`);

  const { kitchen, area } = found;
  const target = areaId ? await requireArea(db, areaId) : area;
  const delivery = deliveryTo(kitchen, target);
  if (!delivery) {
    throw new ApiError(
      'out_of_range',
      `${kitchen.nameEn} does not deliver to ${target.nameEn}.`,
    );
  }

  const [[eta], cuisineRefs, rating, reviews, sections, items] = await Promise.all([
    arrivalWindows(db, ml, [{ kitchen, km: delivery.km }], now),
    cuisinesByKitchen(db, [kitchen.id]),
    ratingOfKitchen(db, kitchen.id),
    reviewsForPage(db, kitchen.id),
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

  const menu: MenuSectionDto[] = sections.map((section) => ({
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

  return {
    ...toSummary(
      kitchen,
      area,
      { ...delivery, ...eta },
      cuisineRefs.get(kitchen.id) ?? [],
      rating,
      config,
      now,
    ),
    address: { en: kitchen.addressEn, bn: kitchen.addressBn },
    pricing: { serviceFee: config.serviceFee, vatRate: config.vatRate },
    sections: menu,
    reviews,
  };
}

export async function listOffers(db: Database): Promise<OfferDto[]> {
  const rows = await db
    .select()
    .from(promotions)
    .where(and(eq(promotions.active, true), eq(promotions.listed, true)))
    .orderBy(asc(promotions.sort));

  return rows.map((row) => ({
    code: row.code,
    title: { en: row.titleEn, bn: row.titleBn },
    terms: { en: row.termsEn, bn: row.termsBn },
    paidBy: row.paidBy,
  }));
}
