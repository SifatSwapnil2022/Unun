/**
 * The Python service is an extra. These tests stand in for it, and check both halves of
 * that promise: its answers are used when they come, and nothing breaks when they do not.
 */
import { deliveryWindow } from '@unun/core';
import type {
  AdminSystem,
  KitchenDetail,
  KitchenList,
  OrderDto,
  PairingsDto,
  QuoteDto,
  RecommendationsDto,
} from '@unun/core/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { kitchens } from '../../db/schema';
import { startHarness, type Harness } from '../../test/harness';
import { ADMIN, CUSTOMER } from '../../test/people';
import { menuOf, placeOrder } from '../../test/shop';
import { createMlClient, noMl } from './client';
import { clearEtaCache, dhakaWeekday, toWindow } from './eta';
import type { MlCatalogue, MlOrders } from './export';

const ML = 'http://ml.test';

type Call = { path: string; body: unknown };

/** A stand-in for the Python service. Each test sets what it answers. */
function fakeService() {
  const calls: Call[] = [];
  const state = {
    down: false,
    quantiles: { p10: 20, p50: 26, p90: 33 } as Record<string, number>,
    hits: [] as Array<{ slug: string; score: number; dishes: string[] }>,
    pairings: [] as string[],
    kitchens: [] as Array<{ slug: string; because: string | null }>,
  };

  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ path: url.pathname, body });
    if (state.down) throw new TypeError('fetch failed');

    const answers: Record<string, unknown> = {
      '/health': {
        status: 'ok',
        delivery: { ready: true, version: 'test-1', trainedOn: 'synthetic' },
        search: { kitchens: 69, dishes: 157 },
        pairings: { baskets: 771 },
        catalogue: { source: 'api' },
      },
      '/v1/delivery-time': {
        model: 'test-1',
        predictions: ((body as { orders?: unknown[] } | null)?.orders ?? []).map(
          () => state.quantiles,
        ),
      },
      '/v1/search': { query: url.searchParams.get('q'), kitchens: state.hits },
      '/v1/pairings': { dishes: state.pairings },
      '/v1/kitchens-for': { kitchens: state.kitchens },
    };
    return Response.json(answers[url.pathname] ?? { detail: 'Not found' }, {
      status: url.pathname in answers ? 200 : 404,
    });
  };

  return {
    calls,
    state,
    fetcher,
    callsTo: (path: string) => calls.filter((c) => c.path === path),
  };
}

describe('the client', () => {
  it('answers nothing when the service is switched off', async () => {
    const client = createMlClient({ url: null });
    expect(client).toBe(noMl);
    expect(client.enabled).toBe(false);
    expect(await client.search('kacchi')).toBeNull();
    expect(await client.health()).toBeNull();
  });

  it('answers nothing, and rests, after a failure', async () => {
    const service = fakeService();
    let clock = 1_000_000;
    const failures: unknown[] = [];
    const client = createMlClient({
      url: ML,
      fetch: service.fetcher,
      now: () => clock,
      restMs: 15_000,
      onError: (error) => failures.push(error),
    });

    service.state.down = true;
    expect(await client.search('kacchi')).toBeNull();
    expect(failures).toHaveLength(1);

    // While it rests the service is not asked at all, even once it is back.
    service.state.down = false;
    expect(await client.search('kacchi')).toBeNull();
    expect(service.calls).toHaveLength(1);

    clock += 15_001;
    expect(await client.search('kacchi')).toEqual([]);
    expect(service.calls).toHaveLength(2);
  });

  it('treats an answer in the wrong shape as no answer', async () => {
    const wrong: typeof fetch = async () => Response.json({ kitchens: 'many' });
    const client = createMlClient({ url: ML, fetch: wrong });
    expect(await client.search('kacchi')).toBeNull();
  });

  it('treats an error status as no answer', async () => {
    const failing: typeof fetch = async () =>
      Response.json({ detail: 'no' }, { status: 503 });
    const client = createMlClient({ url: ML, fetch: failing });
    expect(await client.deliveryTimes([features()])).toBeNull();
  });

  it('refuses predictions that do not match the orders one for one', async () => {
    const short: typeof fetch = async () =>
      Response.json({ predictions: [{ p10: 1, p50: 2, p90: 3 }] });
    const client = createMlClient({ url: ML, fetch: short });
    expect(await client.deliveryTimes([features(), features()])).toBeNull();
  });

  it('sends the features under the names the service expects', async () => {
    const service = fakeService();
    const client = createMlClient({ url: ML, fetch: service.fetcher });
    await client.deliveryTimes([features()]);
    expect(service.calls[0]!.body).toEqual({
      orders: [{ prep_minutes: 16, km: 3.2, hour: 13.5, weekday: 6, load: 2, items: 3 }],
    });
  });
});

function features() {
  return { prepMinutes: 16, km: 3.2, hour: 13.5, weekday: 6, load: 2, items: 3 };
}

describe('turning a prediction into a promise', () => {
  const rule = { min: 28, max: 36 };

  it('uses the two ends of the prediction', () => {
    expect(toWindow({ p10: 24.4, p50: 30, p90: 38.6 }, rule)).toEqual({
      min: 24,
      max: 39,
    });
  });

  it('keeps the window wide enough to survive an ordinary delay', () => {
    expect(toWindow({ p10: 30, p50: 31, p90: 32 }, rule)).toEqual({ min: 30, max: 36 });
  });

  it('never promises much sooner than the plain rule would', () => {
    // 60% of the rule's earliest minute is 17.
    expect(toWindow({ p10: 3, p50: 20, p90: 30 }, rule)!.min).toBe(17);
  });

  it('never promises much later than the plain rule would', () => {
    // 180% of the rule's latest minute is 65.
    expect(toWindow({ p10: 40, p50: 90, p90: 300 }, rule)!.max).toBe(65);
  });

  it('throws away an answer that makes no sense', () => {
    expect(toWindow({ p10: Number.NaN, p50: 1, p90: 2 }, rule)).toBeNull();
    expect(toWindow({ p10: 40, p50: 30, p90: 20 }, rule)).toBeNull();
    expect(toWindow({ p10: -5, p50: 1, p90: 2 }, rule)).toBeNull();
    expect(toWindow({ p10: 500, p50: 600, p90: 700 }, rule)).toBeNull();
  });

  it('counts the week from Monday, in Dhaka', () => {
    // Saturday 23:30 UTC is already Sunday morning in Dhaka.
    expect(dhakaWeekday(new Date('2026-10-10T23:30:00Z'))).toBe(6);
    expect(dhakaWeekday(new Date('2026-10-12T07:00:00Z'))).toBe(0);
  });
});

describe('with the service running', () => {
  let api: Harness;
  const service = fakeService();

  beforeAll(async () => {
    api = await startHarness({ mlUrl: ML, mlFetch: service.fetcher, history: true });
  });

  afterAll(async () => {
    await api.close();
  });

  afterEach(() => {
    service.calls.length = 0;
    service.state.down = false;
    service.state.quantiles = { p10: 20, p50: 26, p90: 33 };
    service.state.hits = [];
    clearEtaCache();
    // A failure in one test must not leave the client resting in the next.
    api.advance(60_000);
  });

  /** What the plain rule promises for Dum Ghor over this distance. */
  async function ruleFor(km: number) {
    const [dum] = await api.db
      .select()
      .from(kitchens)
      .where(eq(kitchens.slug, 'dum-ghor'));
    return deliveryWindow(dum!.prepMinutes, km);
  }

  describe('arrival windows', () => {
    it('shows the predicted window on a kitchen and in the list', async () => {
      const page = (await api.get<KitchenDetail>('/v1/kitchens/dum-ghor')).body;
      expect(page.delivery).toMatchObject({
        window: { min: 20, max: 33 },
        estimate: 'model',
      });

      const list = (await api.get<KitchenList>('/v1/kitchens')).body;
      expect(
        list.kitchens.every((kitchen) => kitchen.delivery.estimate === 'model'),
      ).toBe(true);
    });

    it('asks once for a whole list, and not again for a few minutes', async () => {
      await api.get('/v1/kitchens');
      expect(service.callsTo('/v1/delivery-time')).toHaveLength(1);

      await api.get('/v1/kitchens');
      await api.get('/v1/kitchens/dum-ghor');
      expect(service.callsTo('/v1/delivery-time')).toHaveLength(1);
    });

    it('falls back to the plain rule when the service is down', async () => {
      service.state.down = true;
      const page = await api.get<KitchenDetail>('/v1/kitchens/dum-ghor');
      expect(page.status).toBe(200);
      expect(page.body.delivery.estimate).toBe('formula');
      expect(page.body.delivery.window).toEqual(await ruleFor(page.body.delivery.km));
    });

    it('keeps a wild prediction near the plain rule', async () => {
      service.state.quantiles = { p10: 1, p50: 400, p90: 900 };
      const { delivery } = (await api.get<KitchenDetail>('/v1/kitchens/dum-ghor')).body;
      const rule = await ruleFor(delivery.km);
      expect(delivery.estimate).toBe('model');
      expect(delivery.window.min).toBe(Math.max(Math.round(rule.min * 0.6), 5));
      expect(delivery.window.max).toBe(Math.round(rule.max * 1.8));
    });

    it('promises the order the window the quote showed', async () => {
      const [dish] = await menuOf(api, 'dum-ghor');
      const quote = await api.post<QuoteDto>('/v1/quotes', {
        kitchen: 'dum-ghor',
        area: 'old-dhaka',
        lines: [{ itemId: dish!.id, quantity: 3 }],
      });
      expect(quote.body).toMatchObject({
        window: { min: 20, max: 33 },
        estimate: 'model',
      });

      // The service is told how many dishes are in this order.
      const asked = service.callsTo('/v1/delivery-time').at(-1)!.body as {
        orders: Array<{ items: number }>;
      };
      expect(asked.orders[0]!.items).toBe(3);

      const placed = await placeOrder(api, { kitchen: 'dum-ghor', area: 'old-dhaka' });
      const order = (await api.get<OrderDto>(`/v1/orders/${placed.token}`)).body;
      const minutes = (iso: string) =>
        (new Date(iso).getTime() - new Date(order.placedAt).getTime()) / 60_000;
      expect(minutes(order.promisedFrom)).toBe(20);
      expect(minutes(order.promisedTo)).toBe(33);
    });
  });

  describe('search', () => {
    it('shows the kitchens the service found, closest first, with what matched', async () => {
      service.state.hits = [
        {
          slug: 'boro-deg',
          score: 0.9,
          dishes: ['Beef kacchi biryani', 'Not on this menu'],
        },
        { slug: 'dum-ghor', score: 0.8, dishes: ['Mutton kacchi biryani'] },
      ];

      const list = (await api.get<KitchenList>('/v1/kitchens?q=kachi')).body;
      expect(list.search).toBe('model');
      expect(list.kitchens.map((kitchen) => kitchen.slug)).toEqual([
        'boro-deg',
        'dum-ghor',
      ]);
      expect(list.kitchens[0]!.matched).toEqual([
        { en: 'Beef kacchi biryani', bn: 'গরুর কাচ্চি বিরিয়ানি' },
      ]);
      expect(service.callsTo('/v1/search')).toHaveLength(1);
    });

    it('still applies the area, and the order the customer chose', async () => {
      service.state.hits = [
        { slug: 'boro-deg', score: 0.9, dishes: [] },
        { slug: 'dum-ghor', score: 0.8, dishes: [] },
        { slug: 'no-such-kitchen', score: 0.7, dishes: [] },
      ];

      // Boro Deg is in Mirpur, too far from Old Dhaka.
      const near = (await api.get<KitchenList>('/v1/kitchens?q=kachi&area=old-dhaka'))
        .body;
      expect(near.kitchens.map((kitchen) => kitchen.slug)).toEqual(['dum-ghor']);

      const bySlug = (await api.get<KitchenList>('/v1/kitchens?q=kachi&sort=fee')).body;
      expect(bySlug.kitchens).toHaveLength(2);
      expect(bySlug.kitchens.every((kitchen) => kitchen.matched === undefined)).toBe(
        true,
      );
    });

    it('shows nothing when the service finds nothing', async () => {
      service.state.hits = [];
      const list = (await api.get<KitchenList>('/v1/kitchens?q=sushi')).body;
      expect(list).toMatchObject({ total: 0, kitchens: [], search: 'model' });
    });

    it('matches the letters as typed when the service is down', async () => {
      service.state.down = true;
      const list = (await api.get<KitchenList>('/v1/kitchens?q=kacchi')).body;
      expect(list.search).toBe('basic');
      expect(list.total).toBeGreaterThan(0);

      const none = (await api.get<KitchenList>('/v1/kitchens?q=kachchi')).body;
      expect(none.total).toBe(0);
    });

    it('does not search when nothing was typed', async () => {
      const list = (await api.get<KitchenList>('/v1/kitchens')).body;
      expect(list.search).toBeNull();
      expect(service.callsTo('/v1/search')).toHaveLength(0);
    });
  });

  describe('what goes with the bag', () => {
    it('suggests the dishes the service names, from this menu only', async () => {
      const menu = await menuOf(api, 'dum-ghor');
      const kacchi = menu.find((dish) => dish.name.en === 'Mutton kacchi biryani')!;
      service.state.pairings = ['Borhani', 'A dish from somewhere else', 'Firni'];

      const { body } = await api.get<PairingsDto>(
        `/v1/kitchens/dum-ghor/pairings?items=${kacchi.id}`,
      );
      expect(body.source).toBe('model');
      expect(body.items.map((dish) => dish.name.en)).toEqual(['Borhani', 'Firni']);

      const asked = service.callsTo('/v1/pairings')[0]!.body as {
        basket: string[];
        menu: string[];
      };
      expect(asked.basket).toEqual(['Mutton kacchi biryani']);
      expect(asked.menu).not.toContain('Mutton kacchi biryani');
    });

    it('falls back to best sellers when the service is down', async () => {
      const menu = await menuOf(api, 'dum-ghor');
      service.state.down = true;

      const { status, body } = await api.get<PairingsDto>(
        `/v1/kitchens/dum-ghor/pairings?items=${menu[0]!.id}`,
      );
      expect(status).toBe(200);
      expect(body.source).toBe('popular');
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.length).toBeLessThanOrEqual(3);
      expect(body.items.map((dish) => dish.id)).not.toContain(menu[0]!.id);
    });

    it('suggests nothing for an empty bag, and refuses a bag that is not numbers', async () => {
      const empty = await api.get<PairingsDto>('/v1/kitchens/dum-ghor/pairings');
      expect(empty.body.items).toEqual([]);
      expect((await api.get('/v1/kitchens/dum-ghor/pairings?items=abc')).status).toBe(
        404,
      );
      expect((await api.get('/v1/kitchens/no-such/pairings?items=1')).status).toBe(404);
    });
  });

  describe('kitchens for a customer', () => {
    it('needs a signed-in customer', async () => {
      expect((await api.get('/v1/me/recommendations')).status).toBe(401);
    });

    it('picks kitchens from what the customer ordered, and says why', async () => {
      const customer = await api.signIn(CUSTOMER);
      service.state.kitchens = [
        { slug: 'no-such-kitchen', because: 'Mutton kacchi biryani' },
        { slug: 'boro-deg', because: 'Mutton kacchi biryani' },
        { slug: 'koylar-aanch', because: 'Borhani' },
      ];

      const { body } = await customer.get<RecommendationsDto>('/v1/me/recommendations');
      expect(body.kitchens.map((kitchen) => kitchen.slug)).toEqual([
        'boro-deg',
        'koylar-aanch',
      ]);

      // Only the names of dishes leave the API: nothing that says whose they are.
      const sent = JSON.stringify(service.callsTo('/v1/kitchens-for')[0]!.body);
      expect(sent).toContain('"dish"');
      expect(sent).not.toContain(CUSTOMER);
      expect(sent).not.toContain('Rahim');
      expect(sent).not.toContain(String(customer.user.id).padStart(6, '#'));
    });

    it('leaves the section empty when the service is down', async () => {
      const customer = await api.signIn(CUSTOMER);
      service.state.down = true;
      const { status, body } = await customer.get<RecommendationsDto>(
        '/v1/me/recommendations',
      );
      expect(status).toBe(200);
      expect(body).toEqual({ because: null, kitchens: [] });
    });

    it('has nothing for a customer who has never ordered', async () => {
      const newcomer = await api.signIn('01819990001');
      const { body } = await newcomer.get<RecommendationsDto>('/v1/me/recommendations');
      expect(body.kitchens).toEqual([]);
      expect(service.callsTo('/v1/kitchens-for')).toHaveLength(0);
    });
  });

  describe('what the admin sees', () => {
    it('reports the service and what it has loaded', async () => {
      const admin = await api.signIn(ADMIN);
      const up = (await admin.get<AdminSystem>('/v1/admin/system')).body;
      expect(up.ml).toMatchObject({
        running: true,
        delivery: { ready: true, version: 'test-1' },
        search: { dishes: 157 },
      });

      service.state.down = true;
      api.advance(60_000);
      const down = (await admin.get<AdminSystem>('/v1/admin/system')).body;
      expect(down.ml).toEqual({ running: false });
    });

    it('is for admins only', async () => {
      expect((await api.get('/v1/admin/system')).status).toBe(401);
    });
  });
});

describe('the data the service learns from', () => {
  let api: Harness;
  const key = { 'x-internal-key': 'test-key' };

  const read = async <T>(path: string, headers: Record<string, string> = {}) => {
    const response = await api.app.request(path, { headers });
    return { status: response.status, body: (await response.json()) as T };
  };

  beforeAll(async () => {
    api = await startHarness({ internalKey: 'test-key', history: true });
  });

  afterAll(async () => {
    await api.close();
  });

  it('is closed without the key, and with a wrong one', async () => {
    for (const path of ['/internal/ml/catalogue', '/internal/ml/orders']) {
      expect((await read(path)).status).toBe(404);
      expect((await read(path, { 'x-internal-key': 'guess' })).status).toBe(404);
      expect((await read(path, key)).status).toBe(200);
    }
  });

  it('does not exist at all when no key is set', async () => {
    const closed = await startHarness({ internalKey: null });
    const response = await closed.app.request('/internal/ml/catalogue', {
      headers: { 'x-internal-key': '' },
    });
    expect(response.status).toBe(404);
    await closed.close();
  });

  it('gives the menu of every kitchen customers can see', async () => {
    const { body } = await read<MlCatalogue>('/internal/ml/catalogue', key);
    const list = (await api.get<KitchenList>('/v1/kitchens')).body;
    expect(body.kitchens).toHaveLength(list.total);

    const dum = body.kitchens.find((kitchen) => kitchen.slug === 'dum-ghor')!;
    expect(dum.dishes).toContain('Mutton kacchi biryani');
    expect(dum.popular.every((dish) => dum.dishes.includes(dish))).toBe(true);
    expect(body.dishes.find((dish) => dish.name.en === 'Borhani')!.name.bn).toBe(
      'বোরহানি',
    );
  });

  it('gives orders without the people in them', async () => {
    await placeOrder(api, {
      kitchen: 'dum-ghor',
      area: 'old-dhaka',
      customer: { name: 'Zubaida Private', phone: '01712000099' },
      address: 'House 77, Secret Lane',
    });

    const { body } = await read<MlOrders>('/internal/ml/orders', key);
    expect(body.orders.length).toBeGreaterThan(500);
    expect(Object.keys(body.orders[0]!).sort()).toEqual([
      'dishes',
      'items',
      'kitchen',
      'km',
      'minutes',
      'placedAt',
      'prepMinutes',
    ]);

    const text = JSON.stringify(body);
    for (const secret of ['Zubaida', '01712000099', 'Secret Lane', '017000000']) {
      expect(text).not.toContain(secret);
    }

    // The order just placed is there, and not yet delivered.
    expect(body.orders[0]).toMatchObject({ kitchen: 'dum-ghor', minutes: null });
    // Every seeded order was delivered some time ago.
    expect(body.orders.at(-1)!.minutes).toBeGreaterThan(0);
  });
});
