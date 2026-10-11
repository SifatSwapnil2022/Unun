import type {
  ApiErrorBody,
  CodeSent,
  DemoAccountDto,
  OrderSummaryDto,
  SessionDto,
} from '@unun/core/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../../http/session';
import { LUNCHTIME, startHarness, type Harness } from '../../test/harness';
import { ADMIN } from '../../test/people';
import { freshPhone, placeOrder } from '../../test/shop';
import { CODE_ATTEMPTS, CODES_PER_WINDOW } from './service';

let api: Harness;

beforeAll(async () => {
  api = await startHarness();
});

afterAll(async () => {
  await api.close();
});

const askForCode = async (phone: string) => {
  const { body } = await api.post<CodeSent>('/v1/auth/code', { phone });
  return body.demoCode!;
};

describe('asking for a sign-in code', () => {
  it('accepts a Bangladeshi mobile number in any common form', async () => {
    const { status, body } = await api.post<CodeSent>('/v1/auth/code', {
      phone: '+880 1712-345678',
    });
    expect(status).toBe(200);
    expect(body.expiresInSeconds).toBe(300);
    expect(body.demoCode).toMatch(/^\d{6}$/);
  });

  it('refuses a number that is not a mobile number', async () => {
    const { status, body } = await api.post<ApiErrorBody>('/v1/auth/code', {
      phone: '02-9876543',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('invalid_phone');
  });

  it('stops sending codes to one number after a few requests', async () => {
    const phone = freshPhone();
    for (let request = 0; request < CODES_PER_WINDOW; request += 1) {
      expect((await api.post('/v1/auth/code', { phone })).status).toBe(200);
    }

    const blocked = await api.post<ApiErrorBody>('/v1/auth/code', { phone });
    expect(blocked.status).toBe(429);

    // Another number is unaffected, and so is this one once the window has passed.
    expect((await api.post('/v1/auth/code', { phone: freshPhone() })).status).toBe(200);
    api.advance(11 * 60_000);
    expect((await api.post('/v1/auth/code', { phone })).status).toBe(200);
    api.setNow(LUNCHTIME);
  });
});

describe('signing in with a code', () => {
  it('creates an account on first sign-in and returns a session cookie', async () => {
    const phone = freshPhone();
    const code = await askForCode(phone);

    const verified = await api.post<SessionDto>('/v1/auth/verify', { phone, code });
    expect(verified.status).toBe(200);
    expect(verified.body.user).toMatchObject({ phone, role: 'customer', name: '' });

    const [cookie] = verified.headers.getSetCookie();
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('gives the same account on the next sign-in', async () => {
    const phone = freshPhone();
    const first = await api.signIn(phone);
    const second = await api.signIn(phone);
    expect(second.user.id).toBe(first.user.id);
  });

  it('refuses a wrong code and counts the guesses', async () => {
    const phone = freshPhone();
    const code = await askForCode(phone);
    const wrong = code === '000000' ? '000001' : '000000';

    const first = await api.post<ApiErrorBody>('/v1/auth/verify', { phone, code: wrong });
    expect(first.status).toBe(400);
    expect(first.body.error).toMatchObject({
      code: 'invalid_code',
      details: { attemptsLeft: CODE_ATTEMPTS - 1 },
    });

    for (let guess = 1; guess < CODE_ATTEMPTS; guess += 1) {
      await api.post('/v1/auth/verify', { phone, code: wrong });
    }

    // After too many wrong guesses even the right code is refused.
    const late = await api.post<ApiErrorBody>('/v1/auth/verify', { phone, code });
    expect(late.status).toBe(400);
    expect(late.body.error.code).toBe('invalid_code');
  });

  it('refuses a code that has expired', async () => {
    const phone = freshPhone();
    const code = await askForCode(phone);

    api.advance(5 * 60_000 + 1000);
    const { status } = await api.post('/v1/auth/verify', { phone, code });
    expect(status).toBe(400);
    api.setNow(LUNCHTIME);
  });

  it('lets a code be used once', async () => {
    const phone = freshPhone();
    const code = await askForCode(phone);

    expect((await api.post('/v1/auth/verify', { phone, code })).status).toBe(200);
    expect((await api.post('/v1/auth/verify', { phone, code })).status).toBe(400);
  });

  it('only accepts the newest code', async () => {
    const phone = freshPhone();
    const older = await askForCode(phone);
    api.advance(1000);
    const newer = await askForCode(phone);

    if (older !== newer) {
      expect((await api.post('/v1/auth/verify', { phone, code: older })).status).toBe(
        400,
      );
    }
    expect((await api.post('/v1/auth/verify', { phone, code: newer })).status).toBe(200);
    api.setNow(LUNCHTIME);
  });

  it('does not accept a code issued for another number', async () => {
    const mine = freshPhone();
    const theirs = freshPhone();
    const myCode = await askForCode(mine);
    const theirCode = await askForCode(theirs);

    // The codes are random, so once in a million runs they are the same.
    if (myCode !== theirCode) {
      const { status } = await api.post('/v1/auth/verify', {
        phone: theirs,
        code: myCode,
      });
      expect(status).toBe(400);
    }
    expect(
      (await api.post('/v1/auth/verify', { phone: mine, code: myCode })).status,
    ).toBe(200);
  });
});

describe('sessions', () => {
  it('answers /v1/me with nobody when not signed in', async () => {
    const { status, body } = await api.get<SessionDto>('/v1/me');
    expect(status).toBe(200);
    expect(body.user).toBeNull();
  });

  it('knows who is signed in, until they sign out', async () => {
    const person = await api.signIn(freshPhone());
    expect((await person.get<SessionDto>('/v1/me')).body.user?.id).toBe(person.user.id);

    await person.post('/v1/auth/signout', {});
    expect((await person.get<SessionDto>('/v1/me')).body.user).toBeNull();
  });

  it('ends a session after thirty days', async () => {
    const person = await api.signIn(freshPhone());

    api.advance(29 * 24 * 60 * 60_000);
    expect((await person.get<SessionDto>('/v1/me')).body.user).not.toBeNull();

    api.advance(2 * 24 * 60 * 60_000);
    expect((await person.get<SessionDto>('/v1/me')).body.user).toBeNull();
    api.setNow(LUNCHTIME);
  });

  it('ignores a session cookie it did not issue', async () => {
    const response = await api.app.request('/v1/me', {
      headers: { Cookie: `${SESSION_COOKIE}=not-a-real-token` },
    });
    expect(((await response.json()) as SessionDto).user).toBeNull();
  });

  it('asks for sign-in on a route that needs it', async () => {
    const { status, body } = await api.get<ApiErrorBody>('/v1/me/orders');
    expect(status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
  });

  it('refuses a request that changes something unless it is sent as JSON', async () => {
    const response = await api.app.request('/v1/auth/signout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'a=1',
    });
    expect(response.status).toBe(400);
  });
});

describe('orders and the account', () => {
  it('adds an order placed while signed in to the account', async () => {
    const phone = freshPhone();
    const person = await api.signIn(phone);
    const order = await placeOrder(person, {
      kitchen: 'tok-jhal',
      area: 'dhanmondi',
      customer: { name: 'Salma Khatun', phone },
    });

    const { body } = await person.get<OrderSummaryDto[]>('/v1/me/orders');
    expect(body.map((row) => row.publicId)).toEqual([order.publicId]);
    expect(body[0]).toMatchObject({ status: 'placed', total: order.total });
  });

  it('hands over orders placed with the number before its holder signed in', async () => {
    const phone = freshPhone();
    const order = await placeOrder(api, {
      kitchen: 'tok-jhal',
      area: 'dhanmondi',
      customer: { name: 'Salma Khatun', phone },
    });

    const person = await api.signIn(phone);
    const { body } = await person.get<OrderSummaryDto[]>('/v1/me/orders');
    expect(body.map((row) => row.publicId)).toEqual([order.publicId]);
  });

  it('shows nobody else the order', async () => {
    const order = await placeOrder(api, { kitchen: 'tok-jhal', area: 'dhanmondi' });
    const stranger = await api.signIn(freshPhone());

    const { body } = await stranger.get<OrderSummaryDto[]>('/v1/me/orders');
    expect(body.find((row) => row.publicId === order.publicId)).toBeUndefined();
  });
});

describe('demo accounts', () => {
  it('lists one of each kind when demo sign-in is on', async () => {
    const { body } = await api.get<DemoAccountDto[]>('/v1/auth/demo-accounts');
    expect(body.map((account) => account.role)).toEqual([
      'customer',
      'owner',
      'owner',
      'rider',
      'rider',
      'admin',
    ]);
    expect(body.find((account) => account.role === 'owner')?.kitchen?.en).toBe(
      'Dum Ghor',
    );
  });

  it('hides them, and the code, when demo sign-in is off', async () => {
    const real = await startHarness({ demoLogin: false });
    try {
      expect((await real.get<DemoAccountDto[]>('/v1/auth/demo-accounts')).body).toEqual(
        [],
      );

      const phone = freshPhone();
      const sent = await real.post<CodeSent>('/v1/auth/code', { phone });
      expect(sent.body.demoCode).toBeNull();

      // The code went to the SMS sender instead, and it works.
      expect(real.sentCodes.at(-1)?.phone).toBe(phone);
      const person = await real.signIn(ADMIN);
      expect(person.user.role).toBe('admin');
    } finally {
      await real.close();
    }
  });
});
