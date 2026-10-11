import type { AddressDto, ApiErrorBody, SessionDto } from '@unun/core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from '../../test/harness';
import { CUSTOMER } from '../../test/people';
import { freshPhone } from '../../test/shop';
import { MAX_ADDRESSES } from './service';

let api: Harness;

beforeAll(async () => {
  api = await startHarness();
});

afterAll(async () => {
  await api.close();
});

const home = { label: 'Home', area: 'dhanmondi', line: 'House 5, Road 27' };

describe('the profile', () => {
  it('saves a name', async () => {
    const person = await api.signIn(freshPhone());

    const saved = await person.patch<SessionDto>('/v1/me', { name: '  Salma Khatun ' });
    expect(saved.body.user?.name).toBe('Salma Khatun');
    expect((await person.get<SessionDto>('/v1/me')).body.user?.name).toBe('Salma Khatun');
  });

  it('refuses a name that is too short', async () => {
    const person = await api.signIn(freshPhone());
    expect((await person.patch('/v1/me', { name: 'S' })).status).toBe(400);
  });
});

describe('saved addresses', () => {
  it('starts with the address seeded for the demo customer', async () => {
    const person = await api.signIn(CUSTOMER);
    const { body } = await person.get<AddressDto[]>('/v1/me/addresses');
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      label: 'Home',
      line: 'House 5, Road 27',
      area: { id: 'dhanmondi', name: { en: 'Dhanmondi' } },
    });
  });

  it('adds and removes an address', async () => {
    const person = await api.signIn(freshPhone());

    const added = await person.post<AddressDto[]>('/v1/me/addresses', home);
    expect(added.status).toBe(201);
    expect(added.body).toHaveLength(1);

    const removed = await person.remove<AddressDto[]>(
      `/v1/me/addresses/${added.body[0]!.id}`,
    );
    expect(removed.body).toEqual([]);
  });

  it('refuses an area that does not exist', async () => {
    const person = await api.signIn(freshPhone());
    const { status, body } = await person.post<ApiErrorBody>('/v1/me/addresses', {
      ...home,
      area: 'atlantis',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('unknown_area');
  });

  it('stops at the limit', async () => {
    const person = await api.signIn(freshPhone());
    for (let index = 0; index < MAX_ADDRESSES; index += 1) {
      await person.post('/v1/me/addresses', { ...home, label: `Place ${index}` });
    }

    const { status, body } = await person.post<ApiErrorBody>('/v1/me/addresses', home);
    expect(status).toBe(409);
    expect(body.error.code).toBe('limit_reached');
  });

  it('cannot see or remove another person’s address', async () => {
    const owner = await api.signIn(freshPhone());
    const stranger = await api.signIn(freshPhone());
    const { body } = await owner.post<AddressDto[]>('/v1/me/addresses', home);
    const id = body[0]!.id;

    expect((await stranger.get<AddressDto[]>('/v1/me/addresses')).body).toEqual([]);
    await stranger.remove(`/v1/me/addresses/${id}`);
    expect((await owner.get<AddressDto[]>('/v1/me/addresses')).body).toHaveLength(1);
  });

  it('needs a signed-in person', async () => {
    expect((await api.get('/v1/me/addresses')).status).toBe(401);
    expect((await api.post('/v1/me/addresses', home)).status).toBe(401);
  });
});
