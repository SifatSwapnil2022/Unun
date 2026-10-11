import { describe, expect, it } from 'vitest';
import { taka } from './money';
import { applyPromotion, type Promotion, type PromotionContext } from './promotions';

const base: Promotion = {
  code: 'TEST',
  kind: 'amount_off',
  value: taka(100),
  maxDiscount: null,
  minSubtotal: 0,
  kitchenSlug: null,
  cuisineId: null,
  startsMinute: null,
  endsMinute: null,
  firstOrderOnly: false,
  active: true,
};

const context: PromotionContext = {
  subtotal: taka(700),
  deliveryFee: taka(49),
  kitchenSlug: 'dum-ghor',
  kitchenCuisines: ['kacchi'],
  minuteOfDay: 13 * 60,
  previousOrders: 0,
};

describe('applyPromotion', () => {
  it('takes a fixed amount off the food', () => {
    expect(applyPromotion(base, context)).toEqual({
      applied: true,
      discount: taka(100),
      deliveryDiscount: 0,
    });
  });

  it('never discounts more than the food costs', () => {
    const outcome = applyPromotion(base, { ...context, subtotal: taka(60) });
    expect(outcome).toEqual({ applied: true, discount: taka(60), deliveryDiscount: 0 });
  });

  it('takes a percentage off, rounded to whole taka and capped', () => {
    const fifteen: Promotion = {
      ...base,
      kind: 'percent_off',
      value: 15,
      maxDiscount: taka(80),
    };

    // 15% of Tk 230 is Tk 34.50, which rounds to Tk 35.
    expect(applyPromotion(fifteen, { ...context, subtotal: taka(230) })).toMatchObject({
      discount: taka(35),
    });
    // 15% of Tk 700 is Tk 105, capped at Tk 80.
    expect(applyPromotion(fifteen, context)).toMatchObject({ discount: taka(80) });
  });

  it('waives the whole delivery fee for a free-delivery code', () => {
    const free: Promotion = { ...base, kind: 'free_delivery', value: 0 };
    expect(applyPromotion(free, context)).toEqual({
      applied: true,
      discount: 0,
      deliveryDiscount: taka(49),
    });
  });

  it('refuses an inactive promotion', () => {
    expect(applyPromotion({ ...base, active: false }, context)).toEqual({
      applied: false,
      reason: 'inactive',
    });
  });

  it('refuses when the food cost is below the minimum', () => {
    const outcome = applyPromotion({ ...base, minSubtotal: taka(701) }, context);
    expect(outcome).toEqual({ applied: false, reason: 'min_subtotal' });
  });

  it('refuses at a different kitchen or cuisine', () => {
    expect(applyPromotion({ ...base, kitchenSlug: 'sheek' }, context)).toEqual({
      applied: false,
      reason: 'wrong_kitchen',
    });
    expect(applyPromotion({ ...base, cuisineId: 'cha' }, context)).toEqual({
      applied: false,
      reason: 'wrong_cuisine',
    });
  });

  it('applies only inside its daily hours, start included and end excluded', () => {
    const afternoon: Promotion = { ...base, startsMinute: 15 * 60, endsMinute: 17 * 60 };

    expect(applyPromotion(afternoon, { ...context, minuteOfDay: 15 * 60 })).toMatchObject(
      {
        applied: true,
      },
    );
    expect(applyPromotion(afternoon, { ...context, minuteOfDay: 17 * 60 })).toEqual({
      applied: false,
      reason: 'outside_hours',
    });
  });

  it('refuses a first-order code to a returning customer', () => {
    const first: Promotion = { ...base, firstOrderOnly: true };
    expect(applyPromotion(first, context)).toMatchObject({ applied: true });
    expect(applyPromotion(first, { ...context, previousOrders: 2 })).toEqual({
      applied: false,
      reason: 'not_first_order',
    });
  });
});
