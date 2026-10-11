/**
 * Paying online: the test gateway, what happens to an order that is and is not paid
 * for, and money going back when a paid order is cancelled.
 */
import type {
  AdminOrders,
  ApiErrorBody,
  OpenPayment,
  OrderCreated,
  OrderDto,
  OrderSummaryDto,
  PartnerBoard,
  PartnerKitchenDto,
  PaymentDto,
  PaymentOptionDto,
  QuoteDto,
  RiderBoard,
} from '@unun/core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness, type SignedIn } from '../../test/harness';
import { ADMIN, CUSTOMER, OWNER, RIDER } from '../../test/people';
import { freshPhone, menuOf, placeOrder } from '../../test/shop';

let api: Harness;
let owner: SignedIn;
let rider: SignedIn;
let admin: SignedIn;

/** Dum Ghor is run by its owner when its autopilot is off. */
const BY_HAND = { kitchen: 'dum-ghor', area: 'old-dhaka' };
/** Nobody runs Aloo Bukhara, so the simulator does. */
const AUTOPILOT = { kitchen: 'aloo-bukhara', area: 'dhanmondi' };

const MINUTE = 60_000;

const orderOf = async (token: string) =>
  (await api.get<OrderDto>(`/v1/orders/${token}`)).body;

const settle = (token: string, outcome: 'approve' | 'decline' | 'cancel') =>
  api.post<PaymentDto & ApiErrorBody>(`/v1/payments/${token}/sandbox`, { outcome });

const byHand = (on: boolean) =>
  owner.patch<PartnerKitchenDto>('/v1/partner/kitchens/dum-ghor', { autopilot: !on });

/** Places an order to be paid online and returns it with its open payment. */
async function placeOnline(
  where: { kitchen: string; area: string },
  method: 'bkash' | 'card' = 'bkash',
  client = api as Parameters<typeof placeOrder>[0],
) {
  const order = await placeOrder(client, { ...where, paymentMethod: method });
  if (!order.payment) throw new Error('An online order came back without a payment');
  return { ...order, payment: order.payment };
}

beforeAll(async () => {
  api = await startHarness();
  [owner, rider, admin] = await Promise.all([
    api.signIn(OWNER),
    api.signIn(RIDER),
    api.signIn(ADMIN),
  ]);
});

afterAll(async () => {
  await api.close();
});

describe('ways to pay', () => {
  it('offers cash, and bKash and card through the test gateway', async () => {
    const { body } = await api.get<PaymentOptionDto[]>('/v1/payment-options');
    expect(body).toEqual([
      { method: 'cash', sandbox: false },
      { method: 'bkash', sandbox: true },
      { method: 'card', sandbox: true },
    ]);
  });

  it('offers only cash when the test gateway is off and bKash is not set up', async () => {
    const strict = await startHarness({ paymentSandbox: false });
    try {
      const { body } = await strict.get<PaymentOptionDto[]>('/v1/payment-options');
      expect(body).toEqual([{ method: 'cash', sandbox: false }]);

      const [dish] = await menuOf(strict, 'aloo-bukhara');
      const lines = [{ itemId: dish!.id, quantity: 2 }];
      const quote = await strict.post<QuoteDto>('/v1/quotes', { ...AUTOPILOT, lines });
      const refused = await strict.post<ApiErrorBody>('/v1/orders', {
        ...AUTOPILOT,
        lines,
        customer: { name: 'Salma Khatun', phone: freshPhone() },
        address: 'House 14, Road 7',
        paymentMethod: 'bkash',
        expectedTotal: quote.body.breakdown.total,
      });
      expect(refused.status).toBe(409);
      expect(refused.body.error.code).toBe('payment_unavailable');
    } finally {
      await strict.close();
    }
  });

  it('opens no payment for cash', async () => {
    const order = await placeOrder(api, AUTOPILOT);
    expect(order.payment).toBeNull();
    expect((await orderOf(order.token)).payment).toMatchObject({
      method: 'cash',
      state: 'cash_due',
      open: null,
    });
  });
});

describe('an order paid online', () => {
  it('waits, unseen by the kitchen, until the money arrives', async () => {
    await byHand(true);
    const order = await placeOnline(BY_HAND);
    await byHand(false);

    const waiting = await orderOf(order.token);
    expect(waiting.payment).toMatchObject({ method: 'bkash', state: 'awaiting' });
    expect(waiting.payment.open?.token).toBe(order.payment.token);
    expect(waiting.events).toEqual([]);

    const board = (await owner.get<PartnerBoard>('/v1/partner/board')).body;
    expect(board.active.map((ticket) => ticket.publicId)).not.toContain(order.publicId);
    expect(board.today.orders).toBe(0);

    // The kitchen cannot act on an order it has not been told about.
    const early = await owner.post<ApiErrorBody>(
      `/v1/partner/orders/${order.publicId}/advance`,
      { to: 'accepted' },
    );
    expect(early.status).toBe(404);

    const payment = (await api.get<PaymentDto>(`/v1/payments/${order.payment.token}`))
      .body;
    expect(payment).toMatchObject({
      status: 'pending',
      provider: 'sandbox',
      method: 'bkash',
      amount: order.total,
      order: { publicId: order.publicId, token: order.token },
    });
  });

  it('reaches the kitchen once it is paid, and the promised time starts then', async () => {
    await byHand(true);
    const order = await placeOnline(BY_HAND, 'card');
    await byHand(false);
    const placedBeforePaying = Date.parse((await orderOf(order.token)).placedAt);

    api.advance(4 * MINUTE);
    const paid = await settle(order.payment.token, 'approve');
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('paid');

    const started = await orderOf(order.token);
    expect(started.status).toBe('placed');
    expect(started.events.map((event) => event.status)).toEqual(['placed']);
    expect(started.payment).toMatchObject({ method: 'card', state: 'paid', open: null });
    // Four minutes passed before paying. The window is counted from the payment.
    expect(Date.parse(started.placedAt)).toBe(placedBeforePaying + 4 * MINUTE);

    const board = (await owner.get<PartnerBoard>('/v1/partner/board')).body;
    const ticket = board.active.find(
      (candidate) => candidate.publicId === order.publicId,
    );
    expect(ticket).toMatchObject({ status: 'placed', collect: 0 });
    expect(ticket?.payment).toMatchObject({ method: 'card', state: 'paid' });
  });

  it('plays out by itself on autopilot once paid', async () => {
    const order = await placeOnline(AUTOPILOT);
    await settle(order.payment.token, 'approve');

    api.advance((90 * MINUTE) / api.config.demoSpeed);
    const done = await orderOf(order.token);
    expect(done.status).toBe('delivered');
    expect(done.payment.state).toBe('paid');
  });

  it('can be paid only once', async () => {
    const order = await placeOnline(AUTOPILOT);
    expect((await settle(order.payment.token, 'approve')).status).toBe(200);

    const again = await settle(order.payment.token, 'approve');
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('payment_closed');
    expect(
      (await orderOf(order.token)).events.filter((e) => e.status === 'placed'),
    ).toHaveLength(1);
  });

  it('gives the same payment back when the same order is sent twice', async () => {
    const [dish] = await menuOf(api, AUTOPILOT.kitchen);
    const lines = [{ itemId: dish!.id, quantity: 2 }];
    const quote = await api.post<QuoteDto>('/v1/quotes', { ...AUTOPILOT, lines });
    const request = {
      ...AUTOPILOT,
      lines,
      customer: { name: 'Salma Khatun', phone: freshPhone() },
      address: 'House 14, Road 7',
      paymentMethod: 'bkash',
      expectedTotal: quote.body.breakdown.total,
    };
    const key = { 'Idempotency-Key': 'pay-twice-1' };

    const first = await api.post<OrderCreated>('/v1/orders', request, key);
    const second = await api.post<OrderCreated>('/v1/orders', request, key);
    expect(second.body).toEqual(first.body);
    expect(first.body.payment?.token).toBeTruthy();
  });

  it('belongs to the account that placed it, marked as waiting for payment', async () => {
    const customer = await api.signIn(CUSTOMER);
    const order = await placeOnline(AUTOPILOT, 'bkash', customer);

    const mine = (await customer.get<OrderSummaryDto[]>('/v1/me/orders')).body;
    expect(mine.find((row) => row.publicId === order.publicId)?.paymentState).toBe(
      'awaiting',
    );
  });
});

describe('a payment that does not go through', () => {
  it('leaves the order waiting, and a new attempt can be started', async () => {
    const order = await placeOnline(AUTOPILOT);
    const declined = await settle(order.payment.token, 'decline');
    expect(declined.body.status).toBe('failed');

    const still = await orderOf(order.token);
    expect(still.payment).toMatchObject({ state: 'awaiting', open: null });

    const retry = await api.post<OpenPayment>(`/v1/orders/${order.token}/pay`, {});
    expect(retry.status).toBe(201);
    expect(retry.body.token).not.toBe(order.payment.token);

    expect((await settle(retry.body.token, 'approve')).body.status).toBe('paid');
    expect((await orderOf(order.token)).payment.state).toBe('paid');
  });

  it('closes the attempt before it when a new one is started', async () => {
    const order = await placeOnline(AUTOPILOT);
    const retry = await api.post<OpenPayment>(`/v1/orders/${order.token}/pay`, {});

    const old = await settle(order.payment.token, 'approve');
    expect(old.status).toBe(409);
    expect((await orderOf(order.token)).payment.state).toBe('awaiting');
    expect((await settle(retry.body.token, 'cancel')).body.status).toBe('cancelled');
  });

  it('lapses after fifteen minutes, and nothing is charged', async () => {
    const order = await placeOnline(AUTOPILOT);

    api.advance(14 * MINUTE);
    expect((await orderOf(order.token)).payment.state).toBe('awaiting');

    api.advance(2 * MINUTE);
    const lapsed = await orderOf(order.token);
    expect(lapsed.status).toBe('cancelled');
    expect(lapsed.cancelReason).toBe('system:payment_timeout');
    expect(lapsed.payment).toMatchObject({ state: 'not_charged', open: null });

    // The payment page cannot take money for an order that is gone.
    const late = await settle(order.payment.token, 'approve');
    expect(late.status).toBe(409);
    expect(late.body.error).toMatchObject({
      code: 'payment_closed',
      details: { status: 'expired' },
    });
    expect((await orderOf(order.token)).payment.state).toBe('not_charged');

    const retry = await api.post<ApiErrorBody>(`/v1/orders/${order.token}/pay`, {});
    expect(retry.status).toBe(409);
    expect(retry.body.error.code).toBe('payment_closed');
  });

  it('is lapsed by the admin list as well as by its own page', async () => {
    const order = await placeOnline(AUTOPILOT);
    api.advance(16 * MINUTE);

    const listed = (await admin.get<AdminOrders>(`/v1/admin/orders?q=${order.publicId}`))
      .body;
    expect(listed.orders[0]).toMatchObject({
      publicId: order.publicId,
      status: 'cancelled',
    });
    expect(listed.orders[0]?.payment.state).toBe('not_charged');
  });

  it('answers 404 for a payment that does not exist', async () => {
    expect((await api.get('/v1/payments/no-such-token')).status).toBe(404);
    expect((await settle('no-such-token', 'approve')).status).toBe(404);
  });
});

describe('money going back', () => {
  it('refunds a paid order in full when the kitchen declines it', async () => {
    await byHand(true);
    const order = await placeOnline(BY_HAND);
    await byHand(false);
    await settle(order.payment.token, 'approve');

    const declined = await owner.post(`/v1/partner/orders/${order.publicId}/decline`, {
      reason: 'A dish has run out',
    });
    expect(declined.status).toBe(200);

    const after = await orderOf(order.token);
    expect(after.status).toBe('cancelled');
    expect(after.payment).toMatchObject({ state: 'refunded', refunded: order.total });
  });

  it('refunds a paid order in full when support cancels it', async () => {
    const order = await placeOnline(AUTOPILOT);
    await settle(order.payment.token, 'approve');

    await admin.post(`/v1/admin/orders/${order.publicId}/cancel`, {
      reason: 'The customer asked to cancel',
    });
    expect((await orderOf(order.token)).payment).toMatchObject({
      state: 'refunded',
      refunded: order.total,
    });
  });

  it('has nothing to refund when an unpaid or cash order is cancelled', async () => {
    const unpaid = await placeOnline(AUTOPILOT);
    await admin.post(`/v1/admin/orders/${unpaid.publicId}/cancel`, {
      reason: 'Test order',
    });
    expect((await orderOf(unpaid.token)).payment).toMatchObject({
      state: 'not_charged',
      refunded: 0,
      open: null,
    });
    // Its payment page is closed too.
    expect((await settle(unpaid.payment.token, 'approve')).status).toBe(409);

    const cash = await placeOrder(api, AUTOPILOT);
    await admin.post(`/v1/admin/orders/${cash.publicId}/cancel`, {
      reason: 'Test order',
    });
    expect((await orderOf(cash.token)).payment).toMatchObject({
      state: 'not_charged',
      refunded: 0,
    });
  });
});

describe('what the rider collects', () => {
  it('is nothing for an order paid online, and it is left out of their cash', async () => {
    const before = (await rider.get<RiderBoard>('/v1/rider/board')).body.today;

    await byHand(true);
    const order = await placeOnline(BY_HAND);
    await byHand(false);
    await settle(order.payment.token, 'approve');

    const step = (who: SignedIn, side: string, to: string) =>
      who.post(`/v1/${side}/orders/${order.publicId}/advance`, { to });
    await step(owner, 'partner', 'accepted');
    await step(owner, 'partner', 'cooking');
    await rider.post(`/v1/rider/orders/${order.publicId}/claim`, {});
    await step(owner, 'partner', 'ready');

    const carrying = (await rider.get<RiderBoard>('/v1/rider/board')).body;
    expect(carrying.active).toMatchObject({ publicId: order.publicId, collect: 0 });

    await step(rider, 'rider', 'picked_up');
    await step(rider, 'rider', 'delivered');

    const after = (await rider.get<RiderBoard>('/v1/rider/board')).body.today;
    expect(after.deliveries).toBe(before.deliveries + 1);
    expect(after.cashCollected).toBe(before.cashCollected);
    expect(after.earned).toBeGreaterThan(before.earned);
  });
});
