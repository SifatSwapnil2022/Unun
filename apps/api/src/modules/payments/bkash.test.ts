/**
 * The bKash gateway, run against a stand-in for bKash's servers. The stand-in answers
 * the way bKash's documentation says its tokenized checkout does. Nothing here has
 * talked to bKash itself.
 */
import type { OrderDto, PaymentOptionDto } from '@unun/core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { loadConfig } from '../../config';
import { orders, refunds } from '../../db/schema';
import { startHarness, type Harness, type SignedIn } from '../../test/harness';
import { ADMIN } from '../../test/people';
import { placeOrder } from '../../test/shop';

type Call = {
  path: string;
  headers: Record<string, string>;
  body: Record<string, string>;
};

/** A pretend bKash. Tests decide what the next "execute" and "refund" answer. */
function fakeBkash() {
  const calls: Call[] = [];
  const state = { completes: true, refunds: true, down: false, payments: 0 };

  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname.replace('/v1.2.0-beta', '');
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, string>;
    calls.push({ path, headers: init?.headers as Record<string, string>, body });

    const answer = (json: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify(json), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    if (state.down) return answer({ message: 'unavailable' }, 503);

    switch (path) {
      case '/tokenized/checkout/token/grant':
        return answer({ statusCode: '0000', id_token: 'token-1', expires_in: 3600 });
      case '/tokenized/checkout/create':
        state.payments += 1;
        return answer({
          statusCode: '0000',
          paymentID: `TR00${state.payments}`,
          bkashURL: `https://pay.example/bkash/TR00${state.payments}`,
        });
      case '/tokenized/checkout/execute':
        return state.completes
          ? answer({ statusCode: '0000', transactionStatus: 'Completed', trxID: 'TRX9' })
          : answer({ statusCode: '2023', statusMessage: 'Insufficient Balance' });
      case '/tokenized/checkout/payment/refund':
        return state.refunds
          ? answer({ statusCode: '0000', refundTrxID: 'RF7' })
          : answer({ statusCode: '2071', statusMessage: 'Refund not allowed' });
      default:
        return answer({ message: 'no such path' }, 404);
    }
  };

  return { fetcher, calls, state };
}

const AUTOPILOT = { kitchen: 'aloo-bukhara', area: 'dhanmondi' };
const MINUTE = 60_000;

let api: Harness;
let admin: SignedIn;
const bkash = fakeBkash();

const orderOf = async (token: string) =>
  (await api.get<OrderDto>(`/v1/orders/${token}`)).body;

/** bKash sends the customer's browser back to the API with these two values. */
const comeBack = (paymentId: string, status: string) =>
  api.app.request(`/v1/payments/bkash/callback?paymentID=${paymentId}&status=${status}`);

const placeWithBkash = async () => {
  const order = await placeOrder(api, {
    ...AUTOPILOT,
    paymentMethod: 'bkash',
    locale: 'bn',
  });
  const paymentId = order.payment?.url?.split('/').at(-1) ?? '';
  return { ...order, paymentId };
};

beforeAll(async () => {
  api = await startHarness({
    fetch: bkash.fetcher,
    bkash: {
      baseUrl: 'https://bkash.example/v1.2.0-beta',
      username: 'merchant',
      password: 'secret',
      appKey: 'key-1',
      appSecret: 'secret-1',
    },
  });
  admin = await api.signIn(ADMIN);
});

afterAll(async () => {
  await api.close();
});

describe('bKash settings', () => {
  it('needs all four credentials or none', () => {
    expect(loadConfig({}).bkash).toBeNull();
    expect(() => loadConfig({ BKASH_USERNAME: 'merchant' })).toThrow(/all of/);

    const config = loadConfig({
      BKASH_USERNAME: 'merchant',
      BKASH_PASSWORD: 'secret',
      BKASH_APP_KEY: 'key',
      BKASH_APP_SECRET: 'app-secret',
    });
    expect(config.bkash?.baseUrl).toBe('https://tokenized.sandbox.bka.sh/v1.2.0-beta');
  });

  it('sends bKash to bKash and leaves card on the test gateway', async () => {
    const { body } = await api.get<PaymentOptionDto[]>('/v1/payment-options');
    expect(body).toEqual([
      { method: 'cash', sandbox: false },
      { method: 'bkash', sandbox: false },
      { method: 'card', sandbox: true },
    ]);
  });
});

describe('paying with bKash', () => {
  it('opens the payment at bKash and sends the customer to bKash’s page', async () => {
    const order = await placeWithBkash();
    expect(order.payment?.url).toBe(`https://pay.example/bkash/${order.paymentId}`);

    const create = bkash.calls.findLast((call) => call.path.endsWith('/create'));
    expect(create?.headers).toMatchObject({
      Authorization: 'token-1',
      'X-APP-Key': 'key-1',
    });
    expect(create?.body).toMatchObject({
      mode: '0011',
      currency: 'BDT',
      intent: 'sale',
      amount: (order.total / 100).toFixed(2),
      merchantInvoiceNumber: order.publicId,
      callbackURL: 'http://localhost:4000/v1/payments/bkash/callback',
    });
  });

  it('asks for a token once and reuses it', async () => {
    await placeWithBkash();
    await placeWithBkash();
    expect(bkash.calls.filter((call) => call.path.endsWith('/token/grant'))).toHaveLength(
      1,
    );
  });

  it('completes the payment by asking bKash, then sends the customer to their order', async () => {
    const order = await placeWithBkash();
    const back = await comeBack(order.paymentId, 'success');

    expect(back.status).toBe(303);
    expect(back.headers.get('Location')).toBe(
      `http://localhost:3000/bn/orders/${order.token}`,
    );
    expect(bkash.calls.at(-1)).toMatchObject({
      path: '/tokenized/checkout/execute',
      body: { paymentID: order.paymentId },
    });
    expect((await orderOf(order.token)).payment.state).toBe('paid');
  });

  it('does not take the customer’s word that it worked', async () => {
    bkash.state.completes = false;
    const order = await placeWithBkash();
    await comeBack(order.paymentId, 'success');
    bkash.state.completes = true;

    expect((await orderOf(order.token)).payment).toMatchObject({
      state: 'awaiting',
      open: null,
    });
  });

  it('leaves the order waiting when the customer cancels at bKash', async () => {
    const order = await placeWithBkash();
    const executesBefore = bkash.calls.filter((c) => c.path.endsWith('/execute')).length;

    await comeBack(order.paymentId, 'cancel');

    expect((await orderOf(order.token)).payment.state).toBe('awaiting');
    expect(bkash.calls.filter((c) => c.path.endsWith('/execute'))).toHaveLength(
      executesBefore,
    );
  });

  it('keeps the payment open when bKash cannot be reached to confirm it', async () => {
    const order = await placeWithBkash();
    bkash.state.down = true;
    await comeBack(order.paymentId, 'success');
    bkash.state.down = false;

    expect((await orderOf(order.token)).payment.open?.token).toBe(order.payment?.token);
    await comeBack(order.paymentId, 'success');
    expect((await orderOf(order.token)).payment.state).toBe('paid');
  });

  it('pays once, however many times bKash calls back', async () => {
    const order = await placeWithBkash();
    await comeBack(order.paymentId, 'success');
    const executes = bkash.calls.filter((c) => c.path.endsWith('/execute')).length;

    await comeBack(order.paymentId, 'success');
    expect(bkash.calls.filter((c) => c.path.endsWith('/execute'))).toHaveLength(executes);
    expect(
      (await orderOf(order.token)).events.filter((e) => e.status === 'placed'),
    ).toHaveLength(1);
  });

  it('refuses the order outright when bKash cannot be reached to open a payment', async () => {
    bkash.state.down = true;
    await expect(placeWithBkash()).rejects.toThrow(/payment_unavailable/);
    bkash.state.down = false;
  });

  it('answers 404 to a callback for a payment it never opened', async () => {
    expect((await comeBack('TR-UNKNOWN', 'success')).status).toBe(404);
  });
});

describe('refunds through bKash', () => {
  it('sends the money back through bKash when a paid order is cancelled', async () => {
    const order = await placeWithBkash();
    await comeBack(order.paymentId, 'success');

    await admin.post(`/v1/admin/orders/${order.publicId}/cancel`, {
      reason: 'The customer asked to cancel',
    });

    expect(bkash.calls.at(-1)).toMatchObject({
      path: '/tokenized/checkout/payment/refund',
      body: {
        paymentID: order.paymentId,
        trxID: 'TRX9',
        amount: (order.total / 100).toFixed(2),
      },
    });
    expect((await orderOf(order.token)).payment).toMatchObject({
      state: 'refunded',
      refunded: order.total,
    });
  });

  it('takes no money for a payment approved after the order has lapsed', async () => {
    const order = await placeWithBkash();
    api.advance(16 * MINUTE);
    expect((await orderOf(order.token)).status).toBe('cancelled');
    const executes = bkash.calls.filter((c) => c.path.endsWith('/execute')).length;

    // The customer approved at bKash a moment too late. bKash only moves money when
    // the payment is executed, so not executing it is what keeps their money safe.
    await comeBack(order.paymentId, 'success');

    expect(bkash.calls.filter((c) => c.path.endsWith('/execute'))).toHaveLength(executes);
    expect((await orderOf(order.token)).payment).toMatchObject({
      state: 'not_charged',
      refunded: 0,
    });
  });

  it('marks the refund as failed when bKash refuses it, and still records it', async () => {
    const order = await placeWithBkash();
    await comeBack(order.paymentId, 'success');

    bkash.state.refunds = false;
    await admin.post(`/v1/admin/orders/${order.publicId}/cancel`, {
      reason: 'The kitchen cannot make it',
    });
    bkash.state.refunds = true;

    const [refund] = await api.db
      .select()
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .where(eq(orders.publicId, order.publicId));
    expect(refund?.refunds).toMatchObject({ failed: true, amount: order.total });
  });
});
