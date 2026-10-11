import { priceOrder, taka } from '@unun/core';
import type {
  ApiErrorBody,
  KitchenDetail,
  OrderCreated,
  OrderDto,
  OrderRequest,
  QuoteDto,
} from '@unun/core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { orders } from '../../db/schema';
import { LUNCHTIME, startHarness, type Harness } from '../../test/harness';

let api: Harness;
let kacchiId: number;
let borhaniId: number;
let phoneCounter = 0;

/** A different customer each time, so first-order rules do not leak between tests. */
const freshPhone = () => `0171${String(1000000 + (phoneCounter += 1))}`;

const minutesLater = (minutes: number) =>
  new Date(LUNCHTIME.getTime() + (minutes * 60_000) / api.config.demoSpeed);

async function itemId(slug: string, name: string): Promise<number> {
  const { body } = await api.get<KitchenDetail>(`/v1/kitchens/${slug}`);
  const item = body.sections
    .flatMap((section) => section.items)
    .find((candidate) => candidate.name.en === name);
  if (!item) throw new Error(`${slug} has no item called ${name}`);
  return item.id;
}

function orderRequest(overrides: Partial<OrderRequest> = {}): OrderRequest {
  return {
    kitchen: 'dum-ghor',
    area: 'old-dhaka',
    lines: [{ itemId: kacchiId, quantity: 1 }],
    customer: { name: 'Rahim Uddin', phone: freshPhone() },
    address: 'House 14, Nazira Bazar Lane',
    paymentMethod: 'cash',
    expectedTotal: 0,
    ...overrides,
  };
}

/** Asks for a quote first, the way the checkout page does, then places the order. */
async function place(
  overrides: Partial<OrderRequest> = {},
  headers?: Record<string, string>,
) {
  const request = orderRequest(overrides);
  const quote = await api.post<QuoteDto>('/v1/quotes', {
    kitchen: request.kitchen,
    area: request.area,
    lines: request.lines,
    promoCode: request.promoCode,
    phone: request.customer.phone,
  });
  return api.post<OrderCreated & ApiErrorBody>(
    '/v1/orders',
    { ...request, expectedTotal: overrides.expectedTotal ?? quote.body.breakdown.total },
    headers,
  );
}

beforeAll(async () => {
  api = await startHarness();
  kacchiId = await itemId('dum-ghor', 'Mutton kacchi biryani');
  borhaniId = await itemId('dum-ghor', 'Borhani');
});

afterAll(async () => {
  await api.close();
});

describe('POST /v1/quotes', () => {
  it('prices the bag with the shared pricing function', async () => {
    const { status, body } = await api.post<QuoteDto>('/v1/quotes', {
      kitchen: 'dum-ghor',
      area: 'old-dhaka',
      lines: [
        { itemId: kacchiId, quantity: 2 },
        { itemId: borhaniId, quantity: 1 },
      ],
    });

    expect(status).toBe(200);
    expect(body.lines.map((line) => line.total)).toEqual([taka(680), taka(55)]);
    expect(body.breakdown).toEqual(
      priceOrder(
        [
          { unitPrice: taka(340), quantity: 2 },
          { unitPrice: taka(55), quantity: 1 },
        ],
        { deliveryFee: body.breakdown.delivery, serviceFee: taka(10), vatRate: 0.05 },
      ),
    );
    expect(body.promotion).toBeNull();
    expect(body.meetsMinimum).toBe(true);
  });

  it('adds up repeated lines for the same item', async () => {
    const { body } = await api.post<QuoteDto>('/v1/quotes', {
      kitchen: 'dum-ghor',
      area: 'old-dhaka',
      lines: [
        { itemId: kacchiId, quantity: 1 },
        { itemId: kacchiId, quantity: 2 },
      ],
    });
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]?.quantity).toBe(3);
  });

  it('waives delivery for a first order with UNUN1', async () => {
    const { body } = await api.post<QuoteDto>('/v1/quotes', {
      kitchen: 'dum-ghor',
      area: 'old-dhaka',
      lines: [{ itemId: kacchiId, quantity: 1 }],
      promoCode: 'unun1',
    });
    expect(body.promotion).toEqual({ code: 'UNUN1', applied: true });
    expect(body.breakdown.deliveryDiscount).toBe(body.breakdown.delivery);
  });

  it('reports why a code does not apply, without failing the quote', async () => {
    const tooSmall = await api.post<QuoteDto>('/v1/quotes', {
      kitchen: 'dum-ghor',
      area: 'old-dhaka',
      lines: [{ itemId: kacchiId, quantity: 1 }],
      promoCode: 'DUM100',
    });
    expect(tooSmall.body.promotion).toEqual({
      code: 'DUM100',
      applied: false,
      reason: 'min_subtotal',
    });
    expect(tooSmall.body.breakdown.discount).toBe(0);

    const unknown = await api.post<QuoteDto>('/v1/quotes', {
      kitchen: 'dum-ghor',
      area: 'old-dhaka',
      lines: [{ itemId: kacchiId, quantity: 1 }],
      promoCode: 'NOPE',
    });
    expect(unknown.body.promotion).toMatchObject({
      applied: false,
      reason: 'unknown_code',
    });
  });

  it('takes ৳100 off at Dum Ghor once the food reaches ৳600', async () => {
    const { body } = await api.post<QuoteDto>('/v1/quotes', {
      kitchen: 'dum-ghor',
      area: 'old-dhaka',
      lines: [{ itemId: kacchiId, quantity: 2 }],
      promoCode: 'DUM100',
    });
    expect(body.breakdown.discount).toBe(taka(100));
    // VAT is 5% of ৳580, the food cost after the discount.
    expect(body.breakdown.vat).toBe(taka(29));
  });

  it('rejects a malformed request', async () => {
    const { status, body } = await api.post<ApiErrorBody>('/v1/quotes', {
      kitchen: 'dum-ghor',
      area: 'old-dhaka',
      lines: [{ itemId: kacchiId, quantity: 0 }],
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('invalid_request');
  });

  it('rejects an item from another kitchen', async () => {
    const other = await itemId('tok-jhal', 'Fuchka, 8 pieces');
    const { status, body } = await api.post<ApiErrorBody>('/v1/quotes', {
      kitchen: 'dum-ghor',
      area: 'old-dhaka',
      lines: [{ itemId: other, quantity: 1 }],
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe('item_unavailable');
    expect(body.error.details).toEqual({ itemIds: [other] });
  });
});

describe('POST /v1/orders', () => {
  it('places an order and returns its reference and tracking token', async () => {
    const { status, body } = await place();
    expect(status).toBe(201);
    expect(body.publicId).toMatch(/^UN-[2-9A-Z]{6}$/);
    expect(body.token.length).toBeGreaterThanOrEqual(20);
  });

  it('refuses when the total is not the one the customer was shown', async () => {
    const { status, body } = await place({ expectedTotal: taka(1) });
    expect(status).toBe(409);
    expect(body.error.code).toBe('price_changed');

    const details = body.error.details as { quote: QuoteDto };
    expect(details.quote.breakdown.total).toBeGreaterThan(taka(1));
  });

  it('returns the same order when the same request is sent twice', async () => {
    const headers = { 'Idempotency-Key': 'test-key-1' };
    const phone = freshPhone();
    const first = await place({ customer: { name: 'Karim', phone } }, headers);
    const second = await place({ customer: { name: 'Karim', phone } }, headers);

    expect(first.status).toBe(201);
    expect(second.body).toEqual(first.body);
  });

  it('rejects a phone number that is not a Bangladeshi mobile', async () => {
    const { status, body } = await place({ customer: { name: 'Karim', phone: '12345' } });
    expect(status).toBe(400);
    expect(body.error.code).toBe('invalid_phone');
  });

  it('refuses an order below the kitchen minimum', async () => {
    const { status, body } = await place({ lines: [{ itemId: borhaniId, quantity: 1 }] });
    expect(status).toBe(409);
    expect(body.error.code).toBe('below_minimum');
  });

  it('allows the first-order code once per phone number', async () => {
    const customer = { name: 'Salma Khatun', phone: freshPhone() };

    const first = await place({ customer, promoCode: 'UNUN1' });
    expect(first.status).toBe(201);

    const second = await place({ customer, promoCode: 'UNUN1' });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatchObject({
      code: 'promotion_refused',
      details: { reason: 'not_first_order' },
    });
  });

  it('refuses an area the kitchen cannot reach', async () => {
    const { status, body } = await api.post<ApiErrorBody>(
      '/v1/orders',
      orderRequest({ area: 'uttara' }),
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('out_of_range');
  });
});

describe('GET /v1/orders/:token', () => {
  it('moves the order through its states as time passes', async () => {
    api.setNow(LUNCHTIME);
    // First draw: on time. Second draw: lands at the start of the window.
    api.setRandom(0, 0);
    const created = await place({ lines: [{ itemId: kacchiId, quantity: 2 }] });
    const path = `/v1/orders/${created.body.token}`;

    const atStart = await api.get<OrderDto>(path);
    expect(atStart.body.status).toBe('placed');
    expect(atStart.body.events.map((event) => event.status)).toEqual(['placed']);
    expect(atStart.body.arrival).toBeNull();
    expect(atStart.body.customer.phone).toMatch(/^017•••••\d{3}$/);

    api.setNow(minutesLater(5));
    expect((await api.get<OrderDto>(path)).body.status).toBe('cooking');

    api.setNow(minutesLater(21));
    expect((await api.get<OrderDto>(path)).body.status).toBe('ready');

    api.setNow(minutesLater(120));
    const done = await api.get<OrderDto>(path);
    expect(done.body.status).toBe('delivered');
    expect(done.body.events).toHaveLength(6);
    expect(done.body.arrival).toBe('on_time');

    const delivered = new Date(done.body.events.at(-1)!.at).getTime();
    expect(delivered).toBeGreaterThanOrEqual(new Date(done.body.promisedFrom).getTime());
    expect(delivered).toBeLessThanOrEqual(new Date(done.body.promisedTo).getTime());
    api.setNow(LUNCHTIME);
  });

  it('records a late arrival as late', async () => {
    api.setNow(LUNCHTIME);
    // A first draw of 0.99 is above every kitchen's on-time record, so the order is late.
    api.setRandom(0.99, 0.5);
    const created = await place({ lines: [{ itemId: kacchiId, quantity: 2 }] });

    api.setNow(minutesLater(180));
    const { body } = await api.get<OrderDto>(`/v1/orders/${created.body.token}`);
    expect(body.status).toBe('delivered');
    expect(body.arrival).toBe('late');
    api.setNow(LUNCHTIME);
  });

  it('stores the prices as they were when the order was placed', async () => {
    const created = await place({
      lines: [
        { itemId: kacchiId, quantity: 1 },
        { itemId: borhaniId, quantity: 2 },
      ],
    });
    const { body } = await api.get<OrderDto>(`/v1/orders/${created.body.token}`);

    expect(body.lines).toEqual([
      expect.objectContaining({ unitPrice: taka(340), quantity: 1, total: taka(340) }),
      expect.objectContaining({ unitPrice: taka(55), quantity: 2, total: taka(110) }),
    ]);
    expect(body.breakdown.total).toBe(
      body.breakdown.items +
        body.breakdown.delivery +
        body.breakdown.service +
        body.breakdown.vat,
    );
  });

  it('answers 404 for an unknown token', async () => {
    const { status, body } = await api.get<ApiErrorBody>('/v1/orders/not-a-real-token');
    expect(status).toBe(404);
    expect(body.error.code).toBe('not_found');
  });
});

describe('opening hours', () => {
  it('refuses orders to a closed kitchen when hours are enforced', async () => {
    const strict = await startHarness({ alwaysOpen: false });
    try {
      // 03:00 in Dhaka. Dum Ghor opens at 11:00.
      strict.setNow(new Date('2026-10-10T21:00:00Z'));
      const kitchen = await strict.get<KitchenDetail>('/v1/kitchens/dum-ghor');
      expect(kitchen.body.isOpen).toBe(false);

      const item = kitchen.body.sections[0]!.items[0]!;
      const quote = await strict.post<QuoteDto>('/v1/quotes', {
        kitchen: 'dum-ghor',
        area: 'old-dhaka',
        lines: [{ itemId: item.id, quantity: 1 }],
      });
      const { status, body } = await strict.post<ApiErrorBody>('/v1/orders', {
        kitchen: 'dum-ghor',
        area: 'old-dhaka',
        lines: [{ itemId: item.id, quantity: 1 }],
        customer: { name: 'Night Owl', phone: '01912345678' },
        address: 'House 3, Lalbagh Road',
        paymentMethod: 'cash',
        expectedTotal: quote.body.breakdown.total,
      });
      expect(status).toBe(409);
      expect(body.error.code).toBe('kitchen_closed');
    } finally {
      await strict.close();
    }
  });
});

describe('rate limit', () => {
  it('answers 429 once a client passes the limit for placing orders', async () => {
    const limited = await startHarness({ ordersPerMinute: 2 });
    try {
      const attempt = () => limited.post<ApiErrorBody>('/v1/orders', {});
      expect((await attempt()).status).toBe(400);
      expect((await attempt()).status).toBe(400);

      const third = await attempt();
      expect(third.status).toBe(429);
      expect(third.body.error.code).toBe('rate_limited');
    } finally {
      await limited.close();
    }
  });
});

describe('database constraints', () => {
  it('refuses an order whose total is not the sum of its parts', async () => {
    const insert = api.db.insert(orders).values({
      publicId: 'UN-BADSUM',
      token: 'bad-sum-token',
      kitchenId: 1,
      areaId: 'old-dhaka',
      customerName: 'Nobody',
      customerPhone: '01700000000',
      address: 'Nowhere',
      paymentMethod: 'cash',
      itemsTotal: taka(100),
      discount: 0,
      deliveryFee: taka(29),
      deliveryDiscount: 0,
      serviceFee: taka(10),
      vat: taka(5),
      total: taka(999),
      windowMin: 20,
      windowMax: 30,
      placedAt: LUNCHTIME,
    });
    await expect(insert).rejects.toThrow();
  });
});
