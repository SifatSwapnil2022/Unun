/**
 * Where the rider is drawn on the tracking map: from their phone when it has spoken
 * lately, otherwise worked out.
 */
import { straightLineKm } from '@unun/core';
import type {
  ApiErrorBody,
  OrderDto,
  PartnerKitchenDto,
  RiderBoard,
} from '@unun/core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness, type SignedIn } from '../../test/harness';
import { CUSTOMER, OWNER, RIDER } from '../../test/people';
import { placeOrder } from '../../test/shop';

let api: Harness;
let owner: SignedIn;
let rider: SignedIn;

const MINUTE = 60_000;

const orderOf = async (token: string) =>
  (await api.get<OrderDto>(`/v1/orders/${token}`)).body;

const byHand = (on: boolean) =>
  owner.patch<PartnerKitchenDto>('/v1/partner/kitchens/dum-ghor', { autopilot: !on });

/** Places an order at the hand-run kitchen and walks it to "picked up". */
async function pickedUpOrder() {
  await byHand(true);
  const order = await placeOrder(api, { kitchen: 'dum-ghor', area: 'dhanmondi' });
  await byHand(false);

  const step = (who: SignedIn, side: string, to: string) =>
    who.post(`/v1/${side}/orders/${order.publicId}/advance`, { to });
  await step(owner, 'partner', 'accepted');
  await step(owner, 'partner', 'cooking');
  await rider.post(`/v1/rider/orders/${order.publicId}/claim`, {});
  await step(owner, 'partner', 'ready');
  await step(rider, 'rider', 'picked_up');
  return {
    ...order,
    deliver: () => step(rider, 'rider', 'delivered'),
  };
}

beforeAll(async () => {
  api = await startHarness();
  [owner, rider] = await Promise.all([api.signIn(OWNER), api.signIn(RIDER)]);
});

afterAll(async () => {
  await api.close();
});

describe('the map of an order on autopilot', () => {
  it('shows the kitchen and the door, and the rider only while they ride', async () => {
    const order = await placeOrder(api, { kitchen: 'aloo-bukhara', area: 'gulshan' });

    const placed = await orderOf(order.token);
    expect(placed.map.rider).toBeNull();
    expect(placed.map.etaMinutes).toBeNull();
    expect(straightLineKm(placed.map.kitchen, placed.map.destination)).toBeGreaterThan(1);

    // Step through order time until the rider has the food.
    let riding = placed;
    for (let minute = 0; minute < 120 && riding.status !== 'picked_up'; minute += 1) {
      api.advance(MINUTE / api.config.demoSpeed);
      riding = await orderOf(order.token);
    }
    expect(riding.status).toBe('picked_up');
    expect(riding.map.rider?.source).toBe('estimate');
    const first = riding.map;

    api.advance((2 * MINUTE) / api.config.demoSpeed);
    const later = (await orderOf(order.token)).map;
    if (later.rider && first.rider) {
      // Two order-minutes on, the rider is nearer the door and the wait is shorter.
      expect(straightLineKm(later.rider.position, later.destination)).toBeLessThan(
        straightLineKm(first.rider.position, first.destination),
      );
      expect(later.etaMinutes).toBeLessThan(first.etaMinutes ?? 0);
    }

    api.advance((120 * MINUTE) / api.config.demoSpeed);
    const done = await orderOf(order.token);
    expect(done.status).toBe('delivered');
    expect(done.map.rider).toBeNull();
  });
});

describe('the map of an order carried by a rider', () => {
  it('estimates the rider from the time since pickup until their phone reports', async () => {
    const order = await pickedUpOrder();

    const leaving = (await orderOf(order.token)).map;
    expect(leaving.rider?.source).toBe('estimate');
    // They have only just left, so they are drawn at the kitchen.
    expect(straightLineKm(leaving.rider!.position, leaving.kitchen)).toBeLessThan(0.05);
    expect(leaving.etaMinutes).toBeGreaterThan(5);

    const here = { lat: 23.7402, lng: 90.3861 };
    const reported = await rider.post<{ tracked: boolean }>('/v1/rider/location', here);
    expect(reported.body).toEqual({ tracked: true });

    const tracked = (await orderOf(order.token)).map;
    expect(tracked.rider).toEqual({ position: here, source: 'gps' });
    expect(tracked.etaMinutes).toBeGreaterThan(0);

    // A phone that has been silent for a while is no longer believed.
    api.advance(4 * MINUTE);
    expect((await orderOf(order.token)).map.rider?.source).toBe('estimate');

    await order.deliver();
    expect((await orderOf(order.token)).map.rider).toBeNull();
  });

  it('never draws an estimated rider at the door before they say they arrived', async () => {
    const order = await pickedUpOrder();
    api.advance(3 * 60 * MINUTE);

    const map = (await orderOf(order.token)).map;
    expect(map.rider?.source).toBe('estimate');
    expect(straightLineKm(map.rider!.position, map.destination)).toBeGreaterThan(0.05);
    expect(map.etaMinutes).toBe(1);

    await order.deliver();
  });

  it('gives the rider the two places to draw', async () => {
    const order = await pickedUpOrder();
    const board = (await rider.get<RiderBoard>('/v1/rider/board')).body;
    expect(board.active?.map.kitchen.lat).toBeCloseTo(23.71, 1);
    expect(board.active?.map.destination).toEqual(
      (await orderOf(order.token)).map.destination,
    );
    await order.deliver();
  });
});

describe('reporting a location', () => {
  it('is only for riders', async () => {
    const customer = await api.signIn(CUSTOMER);
    const here = { lat: 23.74, lng: 90.38 };
    expect((await api.post('/v1/rider/location', here)).status).toBe(401);
    expect((await customer.post('/v1/rider/location', here)).status).toBe(403);
  });

  it('says so when the rider is carrying nothing, so the phone can stop', async () => {
    const idle = await rider.post<{ tracked: boolean }>('/v1/rider/location', {
      lat: 23.74,
      lng: 90.38,
    });
    expect(idle.body).toEqual({ tracked: false });
  });

  it('refuses a place that is not on the globe', async () => {
    const bad = await rider.post<ApiErrorBody>('/v1/rider/location', {
      lat: 123,
      lng: 90,
    });
    expect(bad.status).toBe(400);
  });
});
