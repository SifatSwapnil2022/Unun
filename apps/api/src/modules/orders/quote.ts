/**
 * Pricing an order. The checkout page asks for a quote; placing an order builds the
 * same quote again on the server and stores it. Both go through `buildQuote`, so the
 * total shown and the total charged are computed by the same code.
 */
import {
  applyPromotion,
  dhakaMinuteOfDay,
  normaliseMobile,
  priceOrder,
  type Promotion,
  type PromotionOutcome,
} from '@unun/core';
import type { PricedLine, QuoteDto, QuoteRequest } from '@unun/core/contracts';
import { and, count, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { kitchens, menuItems, orders, promotions } from '../../db/schema';
import { ApiError } from '../../http/errors';
import {
  cuisinesByKitchen,
  deliveryTo,
  findArea,
  findKitchenRow,
  isOpenNow,
  type AreaRow,
  type CatalogueDeps,
  type KitchenRow,
} from '../catalogue/service';
import { arrivalWindows } from '../ml/eta';

export type BuiltQuote = {
  quote: QuoteDto;
  kitchen: KitchenRow;
  area: AreaRow;
  /** The promotion code as stored, when one was applied. */
  appliedCode: string | null;
};

/** Adds up repeated lines for the same item, keeping first-seen order. */
function mergeLines(lines: QuoteRequest['lines']): Map<number, number> {
  const quantities = new Map<number, number>();
  for (const line of lines) {
    quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity);
  }
  return quantities;
}

async function previousOrders(db: Database, phone: string | undefined): Promise<number> {
  const mobile = phone ? normaliseMobile(phone) : null;
  if (!mobile) return 0;

  const [row] = await db
    .select({ total: count() })
    .from(orders)
    .where(eq(orders.customerPhone, mobile));
  return row?.total ?? 0;
}

async function findPromotion(db: Database, code: string): Promise<Promotion | null> {
  const [row] = await db
    .select({ promotion: promotions, kitchenSlug: kitchens.slug })
    .from(promotions)
    .leftJoin(kitchens, eq(kitchens.id, promotions.kitchenId))
    .where(eq(promotions.code, code))
    .limit(1);
  if (!row) return null;

  const { promotion, kitchenSlug } = row;
  return {
    code: promotion.code,
    kind: promotion.kind,
    value: promotion.value,
    maxDiscount: promotion.maxDiscount,
    minSubtotal: promotion.minSubtotal,
    kitchenSlug,
    cuisineId: promotion.cuisineId,
    startsMinute: promotion.startsMinute,
    endsMinute: promotion.endsMinute,
    firstOrderOnly: promotion.firstOrderOnly,
    active: promotion.active,
  };
}

export async function buildQuote(
  db: Database,
  deps: CatalogueDeps,
  request: QuoteRequest,
  now: Date,
): Promise<BuiltQuote> {
  const { config, ml } = deps;
  const area = await findArea(db, request.area);
  if (!area) {
    throw new ApiError('unknown_area', `There is no delivery area "${request.area}".`);
  }

  const found = await findKitchenRow(db, request.kitchen);
  if (!found)
    throw new ApiError('not_found', `There is no kitchen "${request.kitchen}".`);
  const { kitchen } = found;

  const delivery = deliveryTo(kitchen, area);
  if (!delivery) {
    throw new ApiError(
      'out_of_range',
      `${kitchen.nameEn} does not deliver to ${area.nameEn}.`,
    );
  }

  const quantities = mergeLines(request.lines);
  const itemIds = [...quantities.keys()];
  const items = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.kitchenId, kitchen.id), inArray(menuItems.id, itemIds)));

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const missing = itemIds.filter((id) => !itemsById.get(id)?.available);
  if (missing.length > 0) {
    throw new ApiError(
      'item_unavailable',
      'Some items in the bag are no longer on this menu.',
      { itemIds: missing },
    );
  }

  const lines: PricedLine[] = itemIds.map((id) => {
    const item = itemsById.get(id)!;
    const quantity = quantities.get(id)!;
    return {
      itemId: id,
      name: { en: item.nameEn, bn: item.nameBn },
      unitPrice: item.price,
      quantity,
      total: item.price * quantity,
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);

  // The window is worked out for this order: a big order takes a kitchen longer.
  const portions = lines.reduce((sum, line) => sum + line.quantity, 0);
  const [eta] = await arrivalWindows(
    db,
    ml,
    [{ kitchen, km: delivery.km, items: portions }],
    now,
  );

  const code = request.promoCode?.trim().toUpperCase() ?? '';
  let outcome: PromotionOutcome | null = null;
  if (code) {
    const promotion = await findPromotion(db, code);
    if (!promotion) {
      outcome = { applied: false, reason: 'unknown_code' };
    } else {
      const cuisineRefs = await cuisinesByKitchen(db, [kitchen.id]);
      outcome = applyPromotion(promotion, {
        subtotal,
        deliveryFee: delivery.fee,
        kitchenSlug: kitchen.slug,
        kitchenCuisines: (cuisineRefs.get(kitchen.id) ?? []).map((cuisine) => cuisine.id),
        minuteOfDay: dhakaMinuteOfDay(now),
        previousOrders: await previousOrders(db, request.phone),
      });
    }
  }

  const breakdown = priceOrder(lines, {
    deliveryFee: delivery.fee,
    serviceFee: config.serviceFee,
    vatRate: config.vatRate,
    discount: outcome?.applied ? outcome.discount : 0,
    deliveryDiscount: outcome?.applied ? outcome.deliveryDiscount : 0,
  });

  const quote: QuoteDto = {
    kitchen: {
      slug: kitchen.slug,
      name: { en: kitchen.nameEn, bn: kitchen.nameBn },
      minOrder: kitchen.minOrder,
      isOpen: isOpenNow(kitchen, config, now),
    },
    area: { id: area.id, name: { en: area.nameEn, bn: area.nameBn } },
    lines,
    breakdown,
    window: eta?.window ?? delivery.window,
    estimate: eta?.estimate ?? 'formula',
    promotion:
      outcome === null
        ? null
        : outcome.applied
          ? { code, applied: true }
          : { code, applied: false, reason: outcome.reason },
    meetsMinimum: subtotal >= kitchen.minOrder,
  };

  return { quote, kitchen, area, appliedCode: outcome?.applied ? code : null };
}
