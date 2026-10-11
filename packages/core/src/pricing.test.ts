import { describe, expect, it } from 'vitest';
import { roundToTaka, taka } from './money';
import { priceOrder, type FeeRules } from './pricing';

const rules: FeeRules = {
  deliveryFee: taka(39),
  serviceFee: taka(10),
  vatRate: 0.05,
};

describe('priceOrder', () => {
  it('adds food, delivery, service fee and VAT into one total', () => {
    const result = priceOrder(
      [
        { unitPrice: taka(320), quantity: 1 },
        { unitPrice: taka(60), quantity: 1 },
        { unitPrice: taka(40), quantity: 1 },
      ],
      rules,
    );

    expect(result).toEqual({
      items: taka(420),
      discount: 0,
      delivery: taka(39),
      deliveryDiscount: 0,
      service: taka(10),
      vat: taka(21),
      total: taka(490),
    });
  });

  it('multiplies unit price by quantity', () => {
    const result = priceOrder([{ unitPrice: taka(150), quantity: 3 }], rules);
    expect(result.items).toBe(taka(450));
  });

  it('charges VAT on food after the discount, not before', () => {
    const result = priceOrder([{ unitPrice: taka(600), quantity: 1 }], {
      ...rules,
      discount: taka(100),
    });

    expect(result.vat).toBe(taka(25));
    expect(result.total).toBe(taka(600 - 100 + 39 + 10 + 25));
  });

  it('never lets a discount exceed the food cost', () => {
    const result = priceOrder([{ unitPrice: taka(80), quantity: 1 }], {
      ...rules,
      discount: taka(200),
    });

    expect(result.discount).toBe(taka(80));
    expect(result.vat).toBe(0);
    expect(result.total).toBe(taka(39 + 10));
  });

  it('takes a delivery discount off the delivery fee and leaves VAT alone', () => {
    const result = priceOrder([{ unitPrice: taka(400), quantity: 1 }], {
      ...rules,
      deliveryDiscount: taka(39),
    });

    expect(result.deliveryDiscount).toBe(taka(39));
    expect(result.vat).toBe(taka(20));
    expect(result.total).toBe(taka(400 + 10 + 20));
  });

  it('never lets a delivery discount exceed the delivery fee', () => {
    const result = priceOrder([{ unitPrice: taka(400), quantity: 1 }], {
      ...rules,
      deliveryDiscount: taka(500),
    });

    expect(result.deliveryDiscount).toBe(taka(39));
  });

  it('still charges delivery and the service fee on an empty bag', () => {
    const result = priceOrder([], rules);
    expect(result.items).toBe(0);
    expect(result.total).toBe(taka(49));
  });

  it('rounds VAT to whole taka, halves up', () => {
    // 5% of Tk 330 is Tk 16.50, which rounds up to Tk 17.
    expect(priceOrder([{ unitPrice: taka(330), quantity: 1 }], rules).vat).toBe(taka(17));
    // 5% of Tk 325 is Tk 16.25, which rounds down to Tk 16.
    expect(priceOrder([{ unitPrice: taka(325), quantity: 1 }], rules).vat).toBe(taka(16));
  });

  it('rejects fractional paisa, negative amounts and impossible VAT rates', () => {
    expect(() => priceOrder([{ unitPrice: 10.5, quantity: 1 }], rules)).toThrow(
      RangeError,
    );
    expect(() => priceOrder([{ unitPrice: taka(10), quantity: -1 }], rules)).toThrow(
      RangeError,
    );
    expect(() => priceOrder([], { ...rules, deliveryFee: -1 })).toThrow(RangeError);
    expect(() => priceOrder([], { ...rules, vatRate: 1.5 })).toThrow(RangeError);
  });
});

describe('roundToTaka', () => {
  it('rounds paisa to the nearest whole taka', () => {
    expect(roundToTaka(1649)).toBe(1600);
    expect(roundToTaka(1650)).toBe(1700);
    expect(roundToTaka(0)).toBe(0);
  });
});
