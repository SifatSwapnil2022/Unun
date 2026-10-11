/**
 * The kitchen and rider workspaces, tested together because an order passes from one
 * to the other.
 */
import type {
  ApiErrorBody,
  KitchenDetail,
  OrderDto,
  PartnerBoard,
  PartnerKitchenDto,
  PartnerMenu,
  QuoteDto,
  RiderBoard,
} from '@unun/core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LUNCHTIME, startHarness, type Harness, type SignedIn } from '../../test/harness';
import { CUSTOMER, OTHER_OWNER, OTHER_RIDER, OWNER, RIDER } from '../../test/people';
import { menuOf, placeOrder } from '../../test/shop';

let api: Harness;
let owner: SignedIn;
let otherOwner: SignedIn;
let rider: SignedIn;
let otherRider: SignedIn;

const KITCHEN = 'dum-ghor';
const HERE = { kitchen: KITCHEN, area: 'old-dhaka' };

const byHand = (on: boolean) =>
  owner.patch<PartnerKitchenDto>(`/v1/partner/kitchens/${KITCHEN}`, { autopilot: !on });

const advance = (
  who: SignedIn,
  side: 'partner' | 'rider',
  publicId: string,
  to: string,
) => who.post<ApiErrorBody>(`/v1/${side}/orders/${publicId}/advance`, { to });

const statusOf = async (token: string) =>
  (await api.get<OrderDto>(`/v1/orders/${token}`)).body.status;

beforeAll(async () => {
  api = await startHarness();
  [owner, otherOwner, rider, otherRider] = await Promise.all([
    api.signIn(OWNER),
    api.signIn(OTHER_OWNER),
    api.signIn(RIDER),
    api.signIn(OTHER_RIDER),
  ]);
});

afterAll(async () => {
  await api.close();
});

describe('who may open a workspace', () => {
  it('asks for sign-in', async () => {
    expect((await api.get('/v1/partner/board')).status).toBe(401);
    expect((await api.get('/v1/rider/board')).status).toBe(401);
  });

  it('refuses an account with another role', async () => {
    const customer = await api.signIn(CUSTOMER);
    expect((await customer.get('/v1/partner/board')).status).toBe(403);
    expect((await customer.get('/v1/rider/board')).status).toBe(403);
    expect((await rider.get('/v1/partner/board')).status).toBe(403);
    expect((await owner.get('/v1/rider/board')).status).toBe(403);
  });
});

describe('the kitchen board', () => {
  it('shows the owner their own kitchen', async () => {
    const { body } = await owner.get<PartnerBoard>('/v1/partner/board');
    expect(body.kitchen).toMatchObject({
      slug: KITCHEN,
      autopilot: true,
      paused: false,
      isOpen: true,
    });
    expect(body.active).toEqual([]);
  });

  it('does not show a kitchen the owner does not run', async () => {
    const { status } = await owner.get('/v1/partner/board?kitchen=koylar-aanch');
    expect(status).toBe(404);
  });

  it('lists an autopilot order without letting anyone move it', async () => {
    const order = await placeOrder(api, HERE);

    const { body } = await owner.get<PartnerBoard>('/v1/partner/board');
    const row = body.active.find((candidate) => candidate.publicId === order.publicId);
    expect(row).toMatchObject({ status: 'placed', handledBy: 'autopilot' });
    // Kitchen staff see enough of the number to confirm it, not all of it.
    expect(row?.customer.phone).toContain('•');

    const moved = await advance(owner, 'partner', order.publicId, 'accepted');
    expect(moved.status).toBe(409);
    expect(moved.body.error.code).toBe('invalid_transition');
  });

  it('counts today’s orders and their food value, leaving out cancelled ones', async () => {
    const before = (await owner.get<PartnerBoard>('/v1/partner/board')).body.today;
    await byHand(true);
    const kept = await placeOrder(api, HERE);
    const declined = await placeOrder(api, HERE);
    await owner.post(`/v1/partner/orders/${declined.publicId}/decline`, {
      reason: 'Out of mutton today',
    });
    await byHand(false);

    const after = (await owner.get<PartnerBoard>('/v1/partner/board')).body.today;
    expect(after.orders).toBe(before.orders + 1);
    expect(after.sales).toBeGreaterThan(before.sales);

    // Leave nothing waiting for the tests below.
    await owner.post(`/v1/partner/orders/${kept.publicId}/decline`, {
      reason: 'Test over',
    });
  });
});

describe('an order handled by people', () => {
  it('goes from the kitchen to the rider to the door, one step at a time', async () => {
    await byHand(true);
    const order = await placeOrder(api, HERE);
    await byHand(false); // The switch only affects orders placed after it.

    // It waits for the kitchen however long that takes.
    api.advance(10 * 60_000);
    expect(await statusOf(order.token)).toBe('placed');

    // Steps cannot be skipped, and the kitchen cannot take the rider's steps.
    expect((await advance(owner, 'partner', order.publicId, 'cooking')).status).toBe(409);
    expect((await advance(owner, 'partner', order.publicId, 'picked_up')).status).toBe(
      400,
    );

    // Riders are not offered an order the kitchen has not started.
    expect(
      (await rider.post(`/v1/rider/orders/${order.publicId}/claim`, {})).status,
    ).toBe(409);

    expect((await advance(owner, 'partner', order.publicId, 'accepted')).status).toBe(
      200,
    );
    expect((await advance(owner, 'partner', order.publicId, 'cooking')).status).toBe(200);

    const offered = (await rider.get<RiderBoard>('/v1/rider/board')).body;
    expect(offered.active).toBeNull();
    expect(offered.available.map((job) => job.publicId)).toContain(order.publicId);
    expect(offered.available[0]?.customer.phone).toContain('•');

    expect(
      (await rider.post(`/v1/rider/orders/${order.publicId}/claim`, {})).status,
    ).toBe(200);

    // Only one rider can have it.
    const second = await otherRider.post<ApiErrorBody>(
      `/v1/rider/orders/${order.publicId}/claim`,
      {},
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('already_taken');

    // The rider cannot leave before the food is ready.
    expect((await advance(rider, 'rider', order.publicId, 'picked_up')).status).toBe(409);
    expect((await advance(owner, 'partner', order.publicId, 'ready')).status).toBe(200);

    const mine = (await rider.get<RiderBoard>('/v1/rider/board')).body;
    expect(mine.active).toMatchObject({ publicId: order.publicId, status: 'ready' });
    // Now the rider needs the whole number, to call from the gate.
    expect(mine.active?.customer.phone).toMatch(/^01\d{9}$/);
    expect(mine.available.map((job) => job.publicId)).not.toContain(order.publicId);

    // Another rider cannot move it.
    expect((await advance(otherRider, 'rider', order.publicId, 'picked_up')).status).toBe(
      404,
    );

    expect((await advance(rider, 'rider', order.publicId, 'picked_up')).status).toBe(200);
    api.advance(8 * 60_000);
    expect((await advance(rider, 'rider', order.publicId, 'delivered')).status).toBe(200);

    const done = (await api.get<OrderDto>(`/v1/orders/${order.token}`)).body;
    expect(done.status).toBe('delivered');
    expect(done.handledBy).toBe('people');
    expect(done.rider).toEqual({ name: 'Jamal' });
    expect(done.demoSpeed).toBe(1);
    expect(done.events.map((event) => event.status)).toEqual([
      'placed',
      'accepted',
      'cooking',
      'ready',
      'picked_up',
      'delivered',
    ]);
    // Eighteen minutes door to door is ahead of the promise.
    expect(done.arrival).toBe('early');

    const after = (await rider.get<RiderBoard>('/v1/rider/board')).body;
    expect(after.active).toBeNull();
    expect(after.recent[0]?.publicId).toBe(order.publicId);
    expect(after.today).toEqual({
      deliveries: 1,
      earned: done.breakdown.delivery,
      cashCollected: done.breakdown.total,
    });

    const board = (await owner.get<PartnerBoard>('/v1/partner/board')).body;
    expect(board.active.map((row) => row.publicId)).not.toContain(order.publicId);
    expect(board.recent.find((row) => row.publicId === order.publicId)).toMatchObject({
      status: 'delivered',
      rider: { name: 'Jamal Mia' },
    });
    api.setNow(LUNCHTIME);
  });

  it('treats a repeated click as already done', async () => {
    await byHand(true);
    const order = await placeOrder(api, HERE);
    await byHand(false);

    expect((await advance(owner, 'partner', order.publicId, 'accepted')).status).toBe(
      200,
    );
    expect((await advance(owner, 'partner', order.publicId, 'accepted')).status).toBe(
      200,
    );
    expect(await statusOf(order.token)).toBe('accepted');

    await owner.post(`/v1/partner/orders/${order.publicId}/advance`, { to: 'cooking' });
  });

  it('keeps a rider to one delivery at a time', async () => {
    await byHand(true);
    const first = await placeOrder(api, HERE);
    const second = await placeOrder(api, HERE);
    await byHand(false);

    for (const order of [first, second]) {
      await advance(owner, 'partner', order.publicId, 'accepted');
      await advance(owner, 'partner', order.publicId, 'cooking');
    }

    expect(
      (await otherRider.post(`/v1/rider/orders/${first.publicId}/claim`, {})).status,
    ).toBe(200);
    const greedy = await otherRider.post<ApiErrorBody>(
      `/v1/rider/orders/${second.publicId}/claim`,
      {},
    );
    expect(greedy.status).toBe(409);
    expect(greedy.body.error.code).toBe('limit_reached');
  });

  it('cannot be moved by another kitchen’s owner', async () => {
    await byHand(true);
    const order = await placeOrder(api, HERE);
    await byHand(false);

    expect(
      (await advance(otherOwner, 'partner', order.publicId, 'accepted')).status,
    ).toBe(404);
    const { body } = await otherOwner.get<PartnerBoard>('/v1/partner/board');
    expect(body.active.map((row) => row.publicId)).not.toContain(order.publicId);
  });
});

describe('declining an order', () => {
  it('cancels an order the kitchen has not accepted, with the reason', async () => {
    await byHand(true);
    const order = await placeOrder(api, HERE);
    await byHand(false);

    const declined = await owner.post(`/v1/partner/orders/${order.publicId}/decline`, {
      reason: 'Out of mutton today',
    });
    expect(declined.status).toBe(200);

    const { body } = await api.get<OrderDto>(`/v1/orders/${order.token}`);
    expect(body.status).toBe('cancelled');
    expect(body.cancelReason).toBe('Out of mutton today');
    expect(body.arrival).toBeNull();

    // A cancelled order is over.
    expect((await advance(owner, 'partner', order.publicId, 'accepted')).status).toBe(
      409,
    );
  });

  it('is refused once the kitchen has accepted', async () => {
    await byHand(true);
    const order = await placeOrder(api, HERE);
    await byHand(false);
    await advance(owner, 'partner', order.publicId, 'accepted');

    const { status, body } = await owner.post<ApiErrorBody>(
      `/v1/partner/orders/${order.publicId}/decline`,
      { reason: 'Changed our minds' },
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('invalid_transition');
  });

  it('needs a reason', async () => {
    await byHand(true);
    const order = await placeOrder(api, HERE);
    await byHand(false);

    const { status } = await owner.post(`/v1/partner/orders/${order.publicId}/decline`, {
      reason: ' ',
    });
    expect(status).toBe(400);
  });
});

describe('kitchen switches', () => {
  it('stops new orders while the kitchen is paused', async () => {
    const paused = await owner.patch<PartnerKitchenDto>(
      `/v1/partner/kitchens/${KITCHEN}`,
      {
        paused: true,
      },
    );
    expect(paused.body).toMatchObject({ paused: true, isOpen: false });

    const seen = await api.get<KitchenDetail>(`/v1/kitchens/${KITCHEN}`);
    expect(seen.body.isOpen).toBe(false);

    const [dish] = await menuOf(api, KITCHEN);
    const quote = await api.post<QuoteDto>('/v1/quotes', {
      ...HERE,
      lines: [{ itemId: dish!.id, quantity: 2 }],
    });
    const refused = await api.post<ApiErrorBody>('/v1/orders', {
      ...HERE,
      lines: [{ itemId: dish!.id, quantity: 2 }],
      customer: { name: 'Salma Khatun', phone: '01812345678' },
      address: 'House 14, Nazira Bazar Lane',
      paymentMethod: 'cash',
      expectedTotal: quote.body.breakdown.total,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('kitchen_closed');

    await owner.patch(`/v1/partner/kitchens/${KITCHEN}`, { paused: false });
    expect((await api.get<KitchenDetail>(`/v1/kitchens/${KITCHEN}`)).body.isOpen).toBe(
      true,
    );
  });

  it('refuses an empty change and a kitchen that is not the owner’s', async () => {
    expect((await owner.patch(`/v1/partner/kitchens/${KITCHEN}`, {})).status).toBe(400);
    expect(
      (await owner.patch('/v1/partner/kitchens/koylar-aanch', { paused: true })).status,
    ).toBe(404);
  });
});

describe('the kitchen’s menu', () => {
  it('takes a dish off the menu and puts it back', async () => {
    const menu = (await owner.get<PartnerMenu>('/v1/partner/menu')).body;
    const dish = menu.sections[0]!.items[0]!;

    const off = await owner.patch<PartnerMenu>(`/v1/partner/items/${dish.id}`, {
      available: false,
    });
    expect(off.body.sections[0]!.items[0]!.available).toBe(false);

    const quote = await api.post<ApiErrorBody>('/v1/quotes', {
      ...HERE,
      lines: [{ itemId: dish.id, quantity: 1 }],
    });
    expect(quote.status).toBe(409);
    expect(quote.body.error.code).toBe('item_unavailable');

    await owner.patch(`/v1/partner/items/${dish.id}`, { available: true });
    expect(
      (
        await api.post('/v1/quotes', {
          ...HERE,
          lines: [{ itemId: dish.id, quantity: 1 }],
        })
      ).status,
    ).toBe(200);
  });

  it('changes a price, and an order priced before the change is refused', async () => {
    const menu = (await owner.get<PartnerMenu>('/v1/partner/menu')).body;
    const dish = menu.sections[0]!.items[0]!;
    const lines = [{ itemId: dish.id, quantity: 2 }];

    const before = await api.post<QuoteDto>('/v1/quotes', { ...HERE, lines });
    await owner.patch(`/v1/partner/items/${dish.id}`, { price: dish.price + 2000 });

    const stale = await api.post<ApiErrorBody>('/v1/orders', {
      ...HERE,
      lines,
      customer: { name: 'Salma Khatun', phone: '01812345679' },
      address: 'House 14, Nazira Bazar Lane',
      paymentMethod: 'cash',
      expectedTotal: before.body.breakdown.total,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('price_changed');

    await owner.patch(`/v1/partner/items/${dish.id}`, { price: dish.price });
  });

  it('only accepts whole-taka prices within limits', async () => {
    const menu = (await owner.get<PartnerMenu>('/v1/partner/menu')).body;
    const dish = menu.sections[0]!.items[0]!;

    for (const price of [0, 500, 12_345, 600_000]) {
      const { status } = await owner.patch(`/v1/partner/items/${dish.id}`, { price });
      expect(status, `price ${price}`).toBe(400);
    }
  });

  it('cannot change another kitchen’s dish', async () => {
    const [theirs] = await menuOf(api, 'koylar-aanch');
    const { status } = await owner.patch(`/v1/partner/items/${theirs!.id}`, {
      available: false,
    });
    expect(status).toBe(404);
  });
});
