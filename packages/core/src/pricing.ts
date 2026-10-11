/**
 * The single place where an order total is calculated. The menu page, the bag, the
 * checkout quote and the stored order all call this function, so they cannot disagree.
 */
import { assertWholeNonNegative, roundToTaka, type Paisa } from './money';

export type OrderLine = {
  /** Price of one unit, in paisa. */
  unitPrice: Paisa;
  quantity: number;
};

export type FeeRules = {
  deliveryFee: Paisa;
  /** A flat service fee charged per order. */
  serviceFee: Paisa;
  /** VAT as a fraction of the food cost after discount, for example 0.05. */
  vatRate: number;
  /** Discount on food. It can never exceed the food cost. */
  discount?: Paisa;
  /** Discount on delivery. It can never exceed the delivery fee. */
  deliveryDiscount?: Paisa;
};

export type PriceBreakdown = {
  items: Paisa;
  discount: Paisa;
  delivery: Paisa;
  deliveryDiscount: Paisa;
  service: Paisa;
  vat: Paisa;
  total: Paisa;
};

export function priceOrder(lines: readonly OrderLine[], rules: FeeRules): PriceBreakdown {
  let items = 0;
  for (const line of lines) {
    assertWholeNonNegative(line.unitPrice, 'unitPrice');
    assertWholeNonNegative(line.quantity, 'quantity');
    items += line.unitPrice * line.quantity;
  }

  assertWholeNonNegative(rules.deliveryFee, 'deliveryFee');
  assertWholeNonNegative(rules.serviceFee, 'serviceFee');
  assertWholeNonNegative(rules.discount ?? 0, 'discount');
  assertWholeNonNegative(rules.deliveryDiscount ?? 0, 'deliveryDiscount');
  if (rules.vatRate < 0 || rules.vatRate > 1) {
    throw new RangeError(`vatRate must be between 0 and 1, got ${rules.vatRate}`);
  }

  const discount = Math.min(rules.discount ?? 0, items);
  const deliveryDiscount = Math.min(rules.deliveryDiscount ?? 0, rules.deliveryFee);
  const vat = roundToTaka((items - discount) * rules.vatRate);
  const total =
    items - discount + rules.deliveryFee - deliveryDiscount + rules.serviceFee + vat;

  return {
    items,
    discount,
    delivery: rules.deliveryFee,
    deliveryDiscount,
    service: rules.serviceFee,
    vat,
    total,
  };
}
