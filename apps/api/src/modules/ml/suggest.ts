/**
 * Suggestions: what goes with the dishes in a bag, and which kitchens a customer might
 * like next. Both are worked out by the Python service from past orders. Without it,
 * the bag falls back to the kitchen's best sellers and the kitchen picks are left out.
 */
import type { Allergen, ItemTag } from '@unun/core';
import type {
  AdminSystem,
  KitchenSummary,
  MenuItemDto,
  PairingsDto,
  RecommendationsDto,
} from '@unun/core/contracts';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { kitchens, menuItems, orderLines, orders } from '../../db/schema';
import { ApiError } from '../../http/errors';
import { findKitchenRow, listKitchens, type CatalogueDeps } from '../catalogue/service';
import type { MlClient } from './client';

type ItemRow = typeof menuItems.$inferSelect;

const SUGGESTED_DISHES = 3;
const SUGGESTED_KITCHENS = 3;
/** How far back a customer's taste is read. */
const HISTORY_ORDERS = 40;

function toItemDto(item: ItemRow): MenuItemDto {
  return {
    id: item.id,
    name: { en: item.nameEn, bn: item.nameBn },
    description: { en: item.descriptionEn, bn: item.descriptionBn },
    price: item.price,
    photo: item.photo,
    tags: item.tags as ItemTag[],
    allergens: item.allergens as Allergen[],
    popular: item.popular,
    available: item.available,
  };
}

/** Dishes from this kitchen that go with the ones already in the bag. */
export async function pairingsFor(
  db: Database,
  ml: MlClient,
  input: { slug: string; itemIds: number[] },
): Promise<PairingsDto> {
  const found = await findKitchenRow(db, input.slug);
  if (!found) throw new ApiError('not_found', `There is no kitchen "${input.slug}".`);

  const menu = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.kitchenId, found.kitchen.id), eq(menuItems.available, true)))
    .orderBy(asc(menuItems.sort));

  const inBag = menu.filter((item) => input.itemIds.includes(item.id));
  const rest = menu.filter((item) => !input.itemIds.includes(item.id));
  if (inBag.length === 0 || rest.length === 0) return { source: 'popular', items: [] };

  const names = await ml.pairings(
    inBag.map((item) => item.nameEn),
    rest.map((item) => item.nameEn),
    SUGGESTED_DISHES,
  );
  const learned = (names ?? []).flatMap((name) => {
    const item = rest.find((candidate) => candidate.nameEn === name);
    return item ? [item] : [];
  });
  if (learned.length > 0) {
    return { source: 'model', items: learned.slice(0, SUGGESTED_DISHES).map(toItemDto) };
  }

  // Without the service: what the kitchen is known for, the cheaper dishes first,
  // because a suggestion beside a full bag is a side or a drink more often than a main.
  const sellers = [...rest].sort(
    (a, b) => Number(b.popular) - Number(a.popular) || a.price - b.price,
  );
  return { source: 'popular', items: sellers.slice(0, SUGGESTED_DISHES).map(toItemDto) };
}

/**
 * Kitchens a signed-in customer has not tried, chosen from what they ordered before.
 * Only the names of dishes are sent to the service: nothing that says who ordered them.
 */
export async function recommendationsFor(
  db: Database,
  deps: CatalogueDeps,
  input: { userId: number; areaId: string | undefined; now: Date },
): Promise<RecommendationsDto> {
  const nothing: RecommendationsDto = { because: null, kitchens: [] };
  if (!deps.ml.enabled) return nothing;

  const past = await db
    .select({ id: orders.id, slug: kitchens.slug })
    .from(orders)
    .innerJoin(kitchens, eq(kitchens.id, orders.kitchenId))
    .where(and(eq(orders.userId, input.userId), eq(orders.awaitingPayment, false)))
    .orderBy(desc(orders.placedAt))
    .limit(HISTORY_ORDERS);
  if (past.length === 0) return nothing;

  const lines = await db
    .select({
      nameEn: orderLines.nameEn,
      nameBn: orderLines.nameBn,
      quantity: orderLines.quantity,
    })
    .from(orderLines)
    .where(
      inArray(
        orderLines.orderId,
        past.map((order) => order.id),
      ),
    );

  const counts = new Map<string, number>();
  for (const line of lines) {
    counts.set(line.nameEn, (counts.get(line.nameEn) ?? 0) + line.quantity);
  }
  const history = [...counts].map(([dish, count]) => ({ dish, count }));
  const tried = [...new Set(past.map((order) => order.slug))];

  // More are asked for than shown, because some will not deliver to this area.
  const suggested = await deps.ml.kitchensFor(history, tried, SUGGESTED_KITCHENS * 6);
  if (!suggested || suggested.length === 0) return nothing;

  const list = await listKitchens(db, deps, { areaId: input.areaId }, input.now);
  const bySlug = new Map(list.kitchens.map((kitchen) => [kitchen.slug, kitchen]));

  const picked: KitchenSummary[] = [];
  let because: string | null = null;
  for (const suggestion of suggested) {
    const kitchen = bySlug.get(suggestion.slug);
    if (!kitchen || !kitchen.isOpen) continue;
    picked.push(kitchen);
    because ??= suggestion.because;
    if (picked.length === SUGGESTED_KITCHENS) break;
  }

  const named = lines.find((line) => line.nameEn === because);
  return {
    because: named ? { en: named.nameEn, bn: named.nameBn } : null,
    kitchens: picked,
  };
}

/** Whether the Python service is answering, for the admin's overview. */
export async function systemStatus(ml: MlClient): Promise<AdminSystem> {
  const health = await ml.health();
  if (!health) return { ml: { running: false } };
  return {
    ml: {
      running: true,
      delivery: health.delivery,
      search: health.search,
      pairings: health.pairings,
    },
  };
}
