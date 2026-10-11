import { describe, expect, it } from 'vitest';
import { taka } from './money';
import {
  amountPaid,
  cashToCollect,
  paymentState,
  refundable,
  type PaymentFacts,
} from './payments';

const cash: PaymentFacts = {
  method: 'cash',
  status: 'cooking',
  awaitingPayment: false,
  paidOnline: false,
  total: taka(474),
  refunded: 0,
};

const online: PaymentFacts = { ...cash, method: 'bkash', paidOnline: true };

describe('paymentState', () => {
  it('says cash is due until the order is delivered', () => {
    expect(paymentState(cash)).toBe('cash_due');
    expect(paymentState({ ...cash, status: 'delivered' })).toBe('paid');
  });

  it('charges nothing for a cash order that was cancelled', () => {
    expect(paymentState({ ...cash, status: 'cancelled' })).toBe('not_charged');
  });

  it('waits for an online payment, then counts it as paid whatever the order is doing', () => {
    expect(
      paymentState({
        ...online,
        paidOnline: false,
        awaitingPayment: true,
        status: 'placed',
      }),
    ).toBe('awaiting');
    expect(paymentState({ ...online, status: 'placed' })).toBe('paid');
    expect(paymentState({ ...online, status: 'delivered' })).toBe('paid');
  });

  it('charges nothing when an online payment was never completed', () => {
    expect(paymentState({ ...online, paidOnline: false, status: 'cancelled' })).toBe(
      'not_charged',
    );
  });

  it('tells a part refund from a full one', () => {
    expect(paymentState({ ...online, refunded: taka(100) })).toBe('part_refunded');
    expect(paymentState({ ...online, refunded: taka(474) })).toBe('refunded');
  });
});

describe('refundable', () => {
  it('is nothing before any money has been paid', () => {
    expect(refundable(cash)).toBe(0);
    expect(refundable({ ...online, paidOnline: false, awaitingPayment: true })).toBe(0);
  });

  it('is what was paid, less what was already given back', () => {
    expect(refundable(online)).toBe(taka(474));
    expect(refundable({ ...online, refunded: taka(74) })).toBe(taka(400));
    expect(refundable({ ...cash, status: 'delivered', refunded: taka(474) })).toBe(0);
  });

  it('never goes below zero', () => {
    expect(refundable({ ...online, refunded: taka(999) })).toBe(0);
  });
});

describe('amountPaid and cashToCollect', () => {
  it('counts cash as paid only on delivery', () => {
    expect(amountPaid(cash)).toBe(0);
    expect(amountPaid({ ...cash, status: 'delivered' })).toBe(taka(474));
  });

  it('has the rider collect nothing for an order paid online', () => {
    expect(cashToCollect('cash', taka(474))).toBe(taka(474));
    expect(cashToCollect('bkash', taka(474))).toBe(0);
    expect(cashToCollect('card', taka(474))).toBe(0);
  });
});
