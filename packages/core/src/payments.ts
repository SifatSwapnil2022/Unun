/**
 * Paying for an order. Cash is paid to the rider at the door. bKash and card are paid
 * online before the kitchen hears of the order, so nobody cooks food that was never
 * paid for.
 */
import type { Paisa } from './money';
import type { OrderStatus } from './orders';
import type { PaymentMethod } from './types';

/** What an attempt to pay online came to. */
export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'expired',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** The gateways an online payment can go through. */
export const PAYMENT_PROVIDERS = ['sandbox', 'bkash'] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** An unpaid online order is cancelled after this long. */
export const PAYMENT_WINDOW_MINUTES = 15;

export function isOnline(method: PaymentMethod): boolean {
  return method !== 'cash';
}

/** How an order's money stands, in words a customer and support staff both understand. */
export type PaymentState =
  /** Cash, not delivered yet: the rider will collect it. */
  | 'cash_due'
  /** An online payment that has not been completed. The kitchen has not been told. */
  | 'awaiting'
  | 'paid'
  | 'part_refunded'
  | 'refunded'
  /** The order ended before any money changed hands. */
  | 'not_charged';

export type PaymentFacts = {
  method: PaymentMethod;
  status: OrderStatus;
  /** True while an online payment is still open. */
  awaitingPayment: boolean;
  /** When the online payment went through, if it has. */
  paidOnline: boolean;
  total: Paisa;
  /** Money already given back. */
  refunded: Paisa;
};

/** What the customer has actually paid: the total, once it is paid, else nothing. */
export function amountPaid(facts: PaymentFacts): Paisa {
  const paid = isOnline(facts.method) ? facts.paidOnline : facts.status === 'delivered';
  return paid ? facts.total : 0;
}

/** How much can still be given back. Never more than was paid. */
export function refundable(facts: PaymentFacts): Paisa {
  return Math.max(amountPaid(facts) - facts.refunded, 0);
}

export function paymentState(facts: PaymentFacts): PaymentState {
  if (facts.awaitingPayment) return 'awaiting';

  const paid = amountPaid(facts);
  if (paid === 0) return facts.status === 'cancelled' ? 'not_charged' : 'cash_due';
  if (facts.refunded >= paid) return 'refunded';
  return facts.refunded > 0 ? 'part_refunded' : 'paid';
}

/** What the rider collects at the door: the total for a cash order, nothing otherwise. */
export function cashToCollect(method: PaymentMethod, total: Paisa): Paisa {
  return isOnline(method) ? 0 : total;
}
