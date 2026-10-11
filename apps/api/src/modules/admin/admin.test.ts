import type {
  AdminKitchenDto,
  AdminOrders,
  AdminOverview,
  AdminUserDto,
  ApiErrorBody,
  KitchenList,
  OrderDto,
  PartnerBoard,
  SessionDto,
} from '@unun/core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { kitchenSeeds } from '../../seed/kitchens';
import { LUNCHTIME, startHarness, type Harness, type SignedIn } from '../../test/harness';
import { ADMIN, CUSTOMER, OWNER, RIDER } from '../../test/people';
import { freshPhone, placeOrder } from '../../test/shop';

let api: Harness;
let admin: SignedIn;

const HERE = { kitchen: 'dum-ghor', area: 'old-dhaka' };
const ALL_DAY = 24 * 60 * 60_000;

beforeAll(async () => {
  api = await startHarness();
  admin = await api.signIn(ADMIN);
});

afterAll(async () => {
  await api.close();
});

describe('who may open the admin workspace', () => {
  it('needs the admin role on every route', async () => {
    const paths = [
      '/v1/admin/overview',
      '/v1/admin/orders',
      '/v1/admin/kitchens',
      '/v1/admin/users',
    ];
    const owner = await api.signIn(OWNER);

    for (const path of paths) {
      expect((await api.get(path)).status, path).toBe(401);
      expect((await owner.get(path)).status, path).toBe(403);
      expect((await admin.get(path)).status, path).toBe(200);
    }

    expect(
      (await owner.patch('/v1/admin/kitchens/dum-ghor', { active: false })).status,
    ).toBe(403);
  });
});

describe('the overview', () => {
  it('counts orders, sales and people', async () => {
    api.setNow(LUNCHTIME);
    const before = (await admin.get<AdminOverview>('/v1/admin/overview')).body;
    expect(before.kitchens).toEqual({
      total: kitchenSeeds.length,
      hidden: 0,
      paused: 0,
      byHand: 0,
    });
    expect(before.people).toMatchObject({ owner: 2, rider: 2, admin: 1 });
    expect(before.days).toHaveLength(7);
    expect(before.days.at(-1)?.date).toBe('2026-10-11');

    // Both draws at zero: on time, at the very start of the window.
    api.setRandom(0, 0);
    const order = await placeOrder(api, HERE);

    const during = (await admin.get<AdminOverview>('/v1/admin/overview')).body;
    expect(during.today.orders).toBe(before.today.orders + 1);
    expect(during.inProgress).toBe(before.inProgress + 1);
    expect(during.today.sales).toBe(before.today.sales);

    // On autopilot the order is delivered within a few minutes of real time.
    api.advance(10 * 60_000);
    const after = (await admin.get<AdminOverview>('/v1/admin/overview')).body;
    expect(after.inProgress).toBe(before.inProgress);
    expect(after.today.delivered).toBe(before.today.delivered + 1);
    expect(after.today.sales).toBe(before.today.sales + order.total);
    expect(after.days.at(-1)).toMatchObject({ orders: after.today.orders });
    expect(after.week.onTimeShare).toBe(1);
    api.setNow(LUNCHTIME);
  });

  it('includes the seeded week when there is one', async () => {
    const seeded = await startHarness({ history: true });
    try {
      const boss = await seeded.signIn(ADMIN);
      const { body } = await boss.get<AdminOverview>('/v1/admin/overview');

      expect(body.week.orders).toBeGreaterThan(kitchenSeeds.length);
      expect(body.week.delivered).toBe(body.week.orders);
      expect(body.inProgress).toBe(0);
      expect(body.week.onTimeShare).toBeGreaterThan(0.6);
      expect(body.week.onTimeShare).toBeLessThan(1);
      expect(body.days.reduce((sum, day) => sum + day.orders, 0)).toBe(body.week.orders);
      expect(body.people.customer).toBeGreaterThanOrEqual(8);

      // The two kitchens with an owner were run by hand, with the demo riders.
      const owner = await seeded.signIn(OWNER);
      const board = (await owner.get<PartnerBoard>('/v1/partner/board')).body;
      expect(board.recent.length).toBeGreaterThan(0);
      for (const row of board.recent) {
        expect(row).toMatchObject({ status: 'delivered', handledBy: 'people' });
        expect(row.rider).not.toBeNull();
      }
    } finally {
      await seeded.close();
    }
  });
});

describe('orders', () => {
  it('lists every order with the customer’s number, newest first', async () => {
    const phone = freshPhone();
    const order = await placeOrder(api, {
      ...HERE,
      customer: { name: 'Shirin Sultana', phone },
    });

    const { body } = await admin.get<AdminOrders>('/v1/admin/orders');
    expect(body.total).toBeGreaterThan(0);
    expect(body.orders[0]).toMatchObject({
      publicId: order.publicId,
      token: order.token,
      customer: { name: 'Shirin Sultana', phone },
    });
  });

  it('finds orders by reference, customer, number or kitchen', async () => {
    const phone = freshPhone();
    const order = await placeOrder(api, {
      kitchen: 'tok-jhal',
      area: 'dhanmondi',
      customer: { name: 'Nabila Rahman', phone },
    });

    for (const query of [order.publicId, 'nabila', phone, 'Tok Jhal']) {
      const { body } = await admin.get<AdminOrders>(
        `/v1/admin/orders?q=${encodeURIComponent(query)}`,
      );
      expect(
        body.orders.map((row) => row.publicId),
        query,
      ).toContain(order.publicId);
    }

    const nothing = await admin.get<AdminOrders>('/v1/admin/orders?q=zzzz-no-such');
    expect(nothing.body).toEqual({ total: 0, orders: [] });
  });

  it('separates orders in progress from finished ones', async () => {
    api.setNow(LUNCHTIME);
    const order = await placeOrder(api, HERE);

    const live = await admin.get<AdminOrders>('/v1/admin/orders?scope=in_progress');
    expect(live.body.orders.map((row) => row.publicId)).toContain(order.publicId);

    api.advance(ALL_DAY);
    const later = await admin.get<AdminOrders>('/v1/admin/orders?scope=in_progress');
    expect(later.body.orders.map((row) => row.publicId)).not.toContain(order.publicId);
    const done = await admin.get<AdminOrders>('/v1/admin/orders?scope=finished');
    expect(done.body.orders.map((row) => row.publicId)).toContain(order.publicId);
    api.setNow(LUNCHTIME);
  });

  it('cancels an order on autopilot and stops the rest of its journey', async () => {
    api.setNow(LUNCHTIME);
    const order = await placeOrder(api, HERE);
    api.advance(10_000); // Far enough for the simulator to have accepted it.

    const cancelled = await admin.post(`/v1/admin/orders/${order.publicId}/cancel`, {
      reason: 'Customer phoned to cancel',
    });
    expect(cancelled.status).toBe(200);

    api.advance(ALL_DAY);
    const { body } = await api.get<OrderDto>(`/v1/orders/${order.token}`);
    expect(body.status).toBe('cancelled');
    expect(body.cancelReason).toBe('Customer phoned to cancel');
    expect(body.events.map((event) => event.status)).not.toContain('delivered');
    api.setNow(LUNCHTIME);
  });

  it('cannot cancel an order that has been delivered, or one that does not exist', async () => {
    api.setNow(LUNCHTIME);
    const order = await placeOrder(api, HERE);
    api.advance(ALL_DAY);

    const late = await admin.post<ApiErrorBody>(
      `/v1/admin/orders/${order.publicId}/cancel`,
      { reason: 'Too late for this' },
    );
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('invalid_transition');

    const missing = await admin.post('/v1/admin/orders/UN-NOPE00/cancel', {
      reason: 'No such order',
    });
    expect(missing.status).toBe(404);
    api.setNow(LUNCHTIME);
  });
});

describe('kitchens', () => {
  it('lists every kitchen with its owner', async () => {
    const { body } = await admin.get<AdminKitchenDto[]>('/v1/admin/kitchens');
    expect(body).toHaveLength(kitchenSeeds.length);
    expect(body.find((kitchen) => kitchen.slug === 'dum-ghor')?.owner).toMatchObject({
      name: 'Rahima Khatun',
    });
    expect(body.find((kitchen) => kitchen.slug === 'tok-jhal')?.owner).toBeNull();
  });

  it('hides a kitchen from customers and shows it again', async () => {
    const total = async () => (await api.get<KitchenList>('/v1/kitchens')).body.total;
    const before = await total();

    await admin.patch('/v1/admin/kitchens/tok-jhal', { active: false });
    expect(await total()).toBe(before - 1);
    expect((await api.get('/v1/kitchens/tok-jhal')).status).toBe(404);

    await admin.patch('/v1/admin/kitchens/tok-jhal', { active: true });
    expect(await total()).toBe(before);
  });

  it('gives a kitchen to an owner, and only to an owner', async () => {
    const owner = await api.signIn(OWNER);
    const rider = await api.signIn(RIDER);

    const refused = await admin.patch<ApiErrorBody>('/v1/admin/kitchens/tok-jhal', {
      ownerId: rider.user.id,
    });
    expect(refused.status).toBe(400);

    const given = await admin.patch<AdminKitchenDto[]>('/v1/admin/kitchens/tok-jhal', {
      ownerId: owner.user.id,
    });
    expect(given.body.find((kitchen) => kitchen.slug === 'tok-jhal')?.owner?.id).toBe(
      owner.user.id,
    );
    expect((await owner.get('/v1/partner/board?kitchen=tok-jhal')).status).toBe(200);

    await admin.patch('/v1/admin/kitchens/tok-jhal', { ownerId: null });
    expect((await owner.get('/v1/partner/board?kitchen=tok-jhal')).status).toBe(404);
  });

  it('answers 404 for a kitchen that does not exist', async () => {
    const { status } = await admin.patch('/v1/admin/kitchens/no-such', { active: false });
    expect(status).toBe(404);
  });
});

describe('people', () => {
  it('lists people, filtered by role or searched by name and number', async () => {
    const riders = await admin.get<AdminUserDto[]>('/v1/admin/users?role=rider');
    expect(riders.body.map((person) => person.name).sort()).toEqual([
      'Jamal Mia',
      'Sumon Ali',
    ]);

    const byName = await admin.get<AdminUserDto[]>('/v1/admin/users?q=rahima');
    expect(byName.body).toHaveLength(1);
    expect(byName.body[0]).toMatchObject({ role: 'owner', kitchens: ['Dum Ghor'] });

    const byNumber = await admin.get<AdminUserDto[]>(`/v1/admin/users?q=${CUSTOMER}`);
    expect(byNumber.body[0]?.name).toBe('Rahim Uddin');
  });

  it('makes a customer a rider, effective at once', async () => {
    const person = await api.signIn(freshPhone());
    expect((await person.get('/v1/rider/board')).status).toBe(403);

    const changed = await admin.patch<AdminUserDto>(`/v1/admin/users/${person.user.id}`, {
      role: 'rider',
    });
    expect(changed.body.role).toBe('rider');

    // The session that was already open now carries the new role.
    expect((await person.get('/v1/rider/board')).status).toBe(200);
    expect((await person.get<SessionDto>('/v1/me')).body.user?.role).toBe('rider');
  });

  it('takes an owner’s kitchens away with the role', async () => {
    const person = await api.signIn(freshPhone());
    await admin.patch(`/v1/admin/users/${person.user.id}`, { role: 'owner' });
    await admin.patch('/v1/admin/kitchens/bikel', { ownerId: person.user.id });
    expect((await person.get('/v1/partner/board')).status).toBe(200);

    await admin.patch(`/v1/admin/users/${person.user.id}`, { role: 'customer' });
    const kitchens = (await admin.get<AdminKitchenDto[]>('/v1/admin/kitchens')).body;
    expect(kitchens.find((kitchen) => kitchen.slug === 'bikel')?.owner).toBeNull();
  });

  it('does not let an admin change their own role', async () => {
    const { status, body } = await admin.patch<ApiErrorBody>(
      `/v1/admin/users/${admin.user.id}`,
      { role: 'customer' },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('forbidden');
  });

  it('refuses a role that does not exist', async () => {
    const person = await api.signIn(freshPhone());
    const { status } = await admin.patch(`/v1/admin/users/${person.user.id}`, {
      role: 'emperor',
    });
    expect(status).toBe(400);
  });
});
