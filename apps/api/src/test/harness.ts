import type { CodeSent, SessionDto, UserDto } from '@unun/core/contracts';
import type { Hono } from 'hono';
import { createApp } from '../app';
import { loadConfig, type Config } from '../config';
import { openDatabase, type Database } from '../db/client';
import { SESSION_COOKIE } from '../http/session';
import { seedDatabase } from '../seed';

/** 13:00 in Dhaka on a Sunday: lunch is open, the afternoon tea offer is not. */
export const LUNCHTIME = new Date('2026-10-11T07:00:00Z');

type Answer<T> = { status: number; body: T; headers: Headers };

/** Calls the API. A signed-in client sends its session cookie with every call. */
export type Client = {
  get: <T>(path: string) => Promise<Answer<T>>;
  post: <T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ) => Promise<Answer<T>>;
  patch: <T>(path: string, body: unknown) => Promise<Answer<T>>;
  remove: <T>(path: string) => Promise<Answer<T>>;
};

export type SignedIn = Client & { user: UserDto };

export type Harness = Client & {
  app: Hono;
  db: Database;
  config: Config;
  /** Moves the clock the API sees. */
  setNow: (instant: Date) => void;
  /** Moves the clock forward. */
  advance: (milliseconds: number) => void;
  /** Queues the values the API will draw as random numbers. Defaults to 0.5. */
  setRandom: (...values: number[]) => void;
  /** Signs in with a mobile number and returns a client that carries the session. */
  signIn: (phone: string) => Promise<SignedIn>;
  /** Codes handed to the SMS sender, newest last. Empty in demo mode. */
  sentCodes: Array<{ phone: string; code: string }>;
  close: () => Promise<void>;
};

export type HarnessOptions = Partial<Config> & {
  /** Seed the past orders and their ratings. Off by default, so tests count only their own. */
  history?: boolean;
  /** Stands in for a payment gateway's servers. */
  fetch?: typeof fetch;
  /** Stands in for the Python service. Give it with `mlUrl`. */
  mlFetch?: typeof fetch;
};

/** Starts the API on a fresh, seeded, in-memory database. */
export async function startHarness(options: HarnessOptions = {}): Promise<Harness> {
  const { history = false, fetch: gatewayFetch, mlFetch, ...overrides } = options;
  const config: Config = {
    ...loadConfig({}),
    demoSpeed: 30,
    // High enough that ordinary tests never meet the limits.
    ordersPerMinute: 1000,
    quotesPerMinute: 1000,
    signInsPerMinute: 1000,
    paymentsPerMinute: 1000,
    locationsPerMinute: 1000,
    feedbackPerMinute: 1000,
    // Tests run without the Python service unless they bring a stand-in for it.
    mlUrl: null,
    ...overrides,
  };

  let now = LUNCHTIME;
  let randoms: number[] = [];
  const sentCodes: Harness['sentCodes'] = [];

  const database = await openDatabase({ databaseUrl: null, dataDir: null });
  await seedDatabase(database.db, {
    now,
    demoAccounts: true,
    history,
    serviceFee: config.serviceFee,
    vatRate: config.vatRate,
  });

  const app = createApp({
    db: database.db,
    config,
    now: () => now,
    random: () => randoms.shift() ?? 0.5,
    fetch: gatewayFetch,
    mlFetch,
    sendCode: async (phone, code) => {
      sentCodes.push({ phone, code });
    },
    onUnexpectedError: (error) => {
      throw error;
    },
  });

  const client = (cookie: string | null): Client => {
    const call = async <T>(
      method: string,
      path: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ): Promise<Answer<T>> => {
      const response = await app.request(path, {
        method,
        headers: {
          ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: response.status,
        body: (await response.json()) as T,
        headers: response.headers,
      };
    };

    return {
      get: (path) => call('GET', path),
      post: (path, body, headers) => call('POST', path, body, headers),
      patch: (path, body) => call('PATCH', path, body),
      remove: (path) => call('DELETE', path),
    };
  };

  const anonymous = client(null);

  const signIn: Harness['signIn'] = async (phone) => {
    const sent = await anonymous.post<CodeSent>('/v1/auth/code', { phone });
    const code = sent.body.demoCode ?? sentCodes.at(-1)?.code;
    if (!code) throw new Error(`No sign-in code was issued for ${phone}`);

    const verified = await anonymous.post<SessionDto>('/v1/auth/verify', { phone, code });
    const cookie = verified.headers
      .getSetCookie()
      .map((value) => value.split(';')[0] ?? '')
      .find((value) => value.startsWith(`${SESSION_COOKIE}=`));
    if (!cookie || !verified.body.user) {
      throw new Error(`Signing in as ${phone} failed with status ${verified.status}`);
    }

    return { ...client(cookie), user: verified.body.user };
  };

  return {
    ...anonymous,
    app,
    db: database.db,
    config,
    setNow: (instant) => {
      now = instant;
    },
    advance: (milliseconds) => {
      now = new Date(now.getTime() + milliseconds);
    },
    setRandom: (...values) => {
      randoms = values;
    },
    signIn,
    sentCodes,
    close: database.close,
  };
}
