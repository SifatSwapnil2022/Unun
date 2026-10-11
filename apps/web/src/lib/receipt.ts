import type { PriceBreakdown } from '@unun/core';
import type { Dictionary } from '@/i18n/dictionaries/en';

export type ReceiptCharge = { label: string; amount: number };

/** The lines of a price breakdown, in the order a receipt lists them. */
export function receiptCharges(
  breakdown: PriceBreakdown,
  labels: Dictionary['pricing']['lines'],
): ReceiptCharge[] {
  const charges: ReceiptCharge[] = [{ label: labels.items, amount: breakdown.items }];
  if (breakdown.discount > 0) {
    charges.push({ label: labels.discount, amount: -breakdown.discount });
  }
  charges.push({ label: labels.delivery, amount: breakdown.delivery });
  if (breakdown.deliveryDiscount > 0) {
    charges.push({ label: labels.deliveryDiscount, amount: -breakdown.deliveryDiscount });
  }
  charges.push(
    { label: labels.service, amount: breakdown.service },
    { label: labels.vat, amount: breakdown.vat },
  );
  return charges;
}
