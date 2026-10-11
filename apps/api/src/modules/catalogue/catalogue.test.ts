import type {
  ApiErrorBody,
  AreaDto,
  CuisineDto,
  KitchenDetail,
  KitchenList,
  OfferDto,
} from '@unun/core/contracts';
import { MAX_DELIVERY_KM } from '@unun/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { kitchenSeeds } from '../../seed/kitchens';
import { startHarness, type Harness } from '../../test/harness';

let api: Harness;

beforeAll(async () => {
  api = await startHarness();
});

afterAll(async () => {
  await api.close();
});

describe('GET /v1/areas and /v1/cuisines', () => {
  it('lists the delivery areas in both languages', async () => {
    const { status, body } = await api.get<AreaDto[]>('/v1/areas');
    expect(status).toBe(200);
    expect(body.length).toBe(14);
    expect(body[0]).toMatchObject({
      id: 'dhanmondi',
      name: { en: 'Dhanmondi', bn: 'ধানমন্ডি' },
    });
  });

  it('counts the kitchens of each cuisine', async () => {
    const { body } = await api.get<CuisineDto[]>('/v1/cuisines');
    const kacchi = body.find((cuisine) => cuisine.id === 'kacchi');
    expect(kacchi?.kitchens).toBe(
      kitchenSeeds.filter((kitchen) => kitchen.cuisines.includes('kacchi')).length,
    );
    expect(body.reduce((sum, cuisine) => sum + cuisine.kitchens, 0)).toBe(
      kitchenSeeds.length,
    );
  });
});

describe('GET /v1/kitchens', () => {
  it('returns every kitchen when no area is given', async () => {
    const { body } = await api.get<KitchenList>('/v1/kitchens');
    expect(body.area).toBeNull();
    expect(body.total).toBe(kitchenSeeds.length);
  });

  it('gives every kitchen a cover and a profile picture, and every dish a photograph', async () => {
    const { body } = await api.get<KitchenList>('/v1/kitchens');

    for (const kitchen of body.kitchens) {
      expect(kitchen.photo, `${kitchen.slug} cover`).toBeTruthy();
      expect(kitchen.profilePhoto, `${kitchen.slug} profile`).toBeTruthy();
    }

    const { body: detail } = await api.get<KitchenDetail>('/v1/kitchens/dum-ghor');
    for (const item of detail.sections.flatMap((section) => section.items)) {
      expect(item.photo, item.name.en).toBeTruthy();
    }
  });

  it('returns only kitchens within range of the chosen area', async () => {
    const { body } = await api.get<KitchenList>('/v1/kitchens?area=uttara');
    expect(body.area?.id).toBe('uttara');
    expect(body.total).toBeGreaterThan(0);
    expect(body.total).toBeLessThan(kitchenSeeds.length);

    for (const kitchen of body.kitchens) {
      expect(kitchen.delivery.areaId).toBe('uttara');
      expect(kitchen.delivery.km).toBeLessThanOrEqual(MAX_DELIVERY_KM);
      expect(kitchen.delivery.window.max).toBeGreaterThan(kitchen.delivery.window.min);
    }
  });

  it('offers at least six kitchens in every area', async () => {
    const { body: areas } = await api.get<AreaDto[]>('/v1/areas');
    for (const area of areas) {
      const { body } = await api.get<KitchenList>(`/v1/kitchens?area=${area.id}`);
      expect(body.total, area.id).toBeGreaterThanOrEqual(6);
    }
  });

  it('sorts by the earliest arrival by default, and by fee on request', async () => {
    const fastest = await api.get<KitchenList>('/v1/kitchens?area=dhanmondi');
    const minutes = fastest.body.kitchens.map((kitchen) => kitchen.delivery.window.min);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));

    const cheapest = await api.get<KitchenList>('/v1/kitchens?area=dhanmondi&sort=fee');
    const fees = cheapest.body.kitchens.map((kitchen) => kitchen.delivery.fee);
    expect(fees).toEqual([...fees].sort((a, b) => a - b));
  });

  it('filters by cuisine', async () => {
    const { body } = await api.get<KitchenList>('/v1/kitchens?cuisine=pitha');
    expect(body.total).toBe(4);
    expect(body.kitchens.every((kitchen) => kitchen.cuisines[0]?.id === 'pitha')).toBe(
      true,
    );
  });

  it('searches kitchen names and dishes in English and Bangla', async () => {
    const byName = await api.get<KitchenList>('/v1/kitchens?q=dum%20ghor');
    expect(byName.body.kitchens.map((kitchen) => kitchen.slug)).toEqual(['dum-ghor']);

    const byDish = await api.get<KitchenList>('/v1/kitchens?q=nehari');
    expect(byDish.body.kitchens.map((kitchen) => kitchen.slug)).toContain('nolli');

    const inBangla = await api.get<KitchenList>(
      `/v1/kitchens?q=${encodeURIComponent('ফুচকা')}`,
    );
    expect(inBangla.body.kitchens.map((kitchen) => kitchen.slug)).toContain('tok-jhal');
  });

  it('treats % in a search as a literal character', async () => {
    const { body } = await api.get<KitchenList>('/v1/kitchens?q=%25');
    expect(body.total).toBe(0);
  });

  it('answers 404 for an area that does not exist', async () => {
    const { status, body } = await api.get<ApiErrorBody>('/v1/kitchens?area=atlantis');
    expect(status).toBe(404);
    expect(body.error.code).toBe('unknown_area');
  });
});

describe('GET /v1/kitchens/:slug', () => {
  it('returns the kitchen with its menu', async () => {
    const { status, body } = await api.get<KitchenDetail>('/v1/kitchens/dum-ghor');
    expect(status).toBe(200);
    expect(body.name).toEqual({ en: 'Dum Ghor', bn: 'দম ঘর' });
    expect(body.sections.length).toBe(3);

    const items = body.sections.flatMap((section) => section.items);
    const kacchi = items.find((item) => item.name.en === 'Mutton kacchi biryani');
    expect(kacchi).toMatchObject({ price: 34000, popular: true, available: true });
  });

  it('works out delivery for the requested area', async () => {
    const near = await api.get<KitchenDetail>('/v1/kitchens/dum-ghor?area=old-dhaka');
    const far = await api.get<KitchenDetail>('/v1/kitchens/dum-ghor?area=dhanmondi');
    expect(far.body.delivery.km).toBeGreaterThan(near.body.delivery.km);
    expect(far.body.delivery.fee).toBeGreaterThanOrEqual(near.body.delivery.fee);
  });

  it('refuses an area the kitchen cannot reach', async () => {
    const { status, body } = await api.get<ApiErrorBody>(
      '/v1/kitchens/dum-ghor?area=uttara',
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('out_of_range');
  });

  it('answers 404 for a kitchen that does not exist', async () => {
    const { status, body } = await api.get<ApiErrorBody>('/v1/kitchens/nowhere');
    expect(status).toBe(404);
    expect(body.error.code).toBe('not_found');
  });
});

describe('GET /v1/offers', () => {
  it('lists the advertised promotions', async () => {
    const { body } = await api.get<OfferDto[]>('/v1/offers');
    expect(body.map((offer) => offer.code)).toEqual(['UNUN1', 'DUM100', 'BIKEL15']);
  });
});
