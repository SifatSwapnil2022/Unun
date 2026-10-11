/**
 * Promotion rules. A promotion either applies and yields a discount, or it is refused
 * with a reason the customer can be shown. There is no third state.
 */
import { roundToTaka, type Paisa } from './money';

export type PromotionKind = 'free_delivery' | 'amount_off' | 'percent_off';

/** Who carries the cost. Shown to the customer, and used later by the ledger. */
export type PromotionPayer = 'platform' | 'restaurant';

export type Promotion = {
  code: string;
  kind: PromotionKind;
  /** amount_off: paisa. percent_off: a whole percentage. free_delivery: unused. */
  value: number;
  /** Upper limit on a percentage discount. */
  maxDiscount: Paisa | null;
  /** The food cost the order must reach. */
  minSubtotal: Paisa;
  /** Limits the promotion to one kitchen. */
  kitchenSlug: string | null;
  /** Limits the promotion to kitchens that serve this cuisine. */
  cuisineId: string | null;
  /** Daily hours in minutes after midnight, Dhaka time. Both null means all day. */
  startsMinute: number | null;
  endsMinute: number | null;
  firstOrderOnly: boolean;
  active: boolean;
};

export type PromotionContext = {
  subtotal: Paisa;
  deliveryFee: Paisa;
  kitchenSlug: string;
  kitchenCuisines: readonly string[];
  /** Minutes after midnight in Dhaka when the order is placed. */
  minuteOfDay: number;
  /** Orders this customer has placed before. */
  previousOrders: number;
};

export type PromotionRejection =
  | 'unknown_code'
  | 'inactive'
  | 'min_subtotal'
  | 'wrong_kitchen'
  | 'wrong_cuisine'
  | 'outside_hours'
  | 'not_first_order';

export type PromotionOutcome =
  | { applied: true; discount: Paisa; deliveryDiscount: Paisa }
  | { applied: false; reason: PromotionRejection };

const refuse = (reason: PromotionRejection): PromotionOutcome => ({
  applied: false,
  reason,
});

function insideHours(promotion: Promotion, minuteOfDay: number): boolean {
  const { startsMinute, endsMinute } = promotion;
  if (startsMinute === null || endsMinute === null) return true;
  return minuteOfDay >= startsMinute && minuteOfDay < endsMinute;
}

export function applyPromotion(
  promotion: Promotion,
  context: PromotionContext,
): PromotionOutcome {
  if (!promotion.active) return refuse('inactive');
  if (promotion.kitchenSlug !== null && promotion.kitchenSlug !== context.kitchenSlug) {
    return refuse('wrong_kitchen');
  }
  if (
    promotion.cuisineId !== null &&
    !context.kitchenCuisines.includes(promotion.cuisineId)
  ) {
    return refuse('wrong_cuisine');
  }
  if (!insideHours(promotion, context.minuteOfDay)) return refuse('outside_hours');
  if (promotion.firstOrderOnly && context.previousOrders > 0) {
    return refuse('not_first_order');
  }
  if (context.subtotal < promotion.minSubtotal) return refuse('min_subtotal');

  switch (promotion.kind) {
    case 'free_delivery':
      return { applied: true, discount: 0, deliveryDiscount: context.deliveryFee };
    case 'amount_off':
      return {
        applied: true,
        discount: Math.min(promotion.value, context.subtotal),
        deliveryDiscount: 0,
      };
    case 'percent_off': {
      const raw = roundToTaka((context.subtotal * promotion.value) / 100);
      const capped =
        promotion.maxDiscount === null ? raw : Math.min(raw, promotion.maxDiscount);
      return { applied: true, discount: capped, deliveryDiscount: 0 };
    }
  }
}
