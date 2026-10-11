import { existsSync } from 'node:fs';
import { normaliseMobile, taka, type Paisa } from '@unun/core';
import { DEFAULT_DATA_DIR, ENV_FILE } from './paths';

export type Config = {
  port: number;
  /** A PostgreSQL connection string, or null to use the embedded database. */
  databaseUrl: string | null;
  /** Where the embedded database keeps its files. */
  dataDir: string;
  webOrigin: string;
  /** How much faster than real time the demo simulator moves an order along. */
  demoSpeed: number;
  /** When true, kitchens take orders outside their opening hours. */
  alwaysOpen: boolean;
  /**
   * Demo sign-in. When true the API hands the one-time code back to the page instead
   * of sending it by SMS, and seeds accounts for an owner, riders and an admin that any
   * visitor may use. It must be false wherever real people sign in.
   */
  demoLogin: boolean;
  /** A mobile number that is made an admin on start. Null changes nobody. */
  adminPhone: string | null;
  /**
   * The test gateway. When true, bKash and card payments go to a page of this site
   * where a visitor approves or declines them, and no money moves.
   */
  paymentSandbox: boolean;
  /** bKash merchant credentials. Null leaves bKash to the test gateway, or off. */
  bkash: BkashConfig | null;
  /** The address gateways call the API back on. */
  publicApiUrl: string;
  /** Send the session cookie over HTTPS only. On in production. */
  secureCookies: boolean;
  serviceFee: Paisa;
  /** VAT on food, as a fraction. */
  vatRate: number;
  /** The address of the Python service in services/ml. Null runs without it. */
  mlUrl: string | null;
  /**
   * What the Python service must send to read its training data. Null closes those
   * addresses altogether.
   */
  internalKey: string | null;
  /** Requests one client address may make per minute. */
  ordersPerMinute: number;
  quotesPerMinute: number;
  signInsPerMinute: number;
  paymentsPerMinute: number;
  locationsPerMinute: number;
  /** Ratings and problem reports from one address. */
  feedbackPerMinute: number;
};

export type BkashConfig = {
  baseUrl: string;
  username: string;
  password: string;
  appKey: string;
  appSecret: string;
};

/** All four credentials, or none. A half-filled set is a mistake worth stopping for. */
function bkash(env: NodeJS.ProcessEnv): BkashConfig | null {
  const values = {
    username: env.BKASH_USERNAME?.trim() ?? '',
    password: env.BKASH_PASSWORD?.trim() ?? '',
    appKey: env.BKASH_APP_KEY?.trim() ?? '',
    appSecret: env.BKASH_APP_SECRET?.trim() ?? '',
  };
  const given = Object.values(values).filter((value) => value !== '').length;
  if (given === 0) return null;
  if (given < 4) {
    throw new Error(
      'Set all of BKASH_USERNAME, BKASH_PASSWORD, BKASH_APP_KEY and BKASH_APP_SECRET, or none.',
    );
  }
  return {
    ...values,
    // bKash's test servers. A live merchant account has its own address.
    baseUrl:
      env.BKASH_BASE_URL?.trim().replace(/\/$/, '') ||
      'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
  };
}

function mobile(name: string, raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === '') return null;
  const phone = normaliseMobile(raw);
  if (!phone)
    throw new Error(`${name} must be a Bangladeshi mobile number, got "${raw}"`);
  return phone;
}

function wholeNumber(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a whole number of 1 or more, got "${raw}"`);
  }
  return value;
}

/** The service is looked for on this machine unless ML_URL says otherwise, or "off". */
function mlUrl(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/$/, '') ?? '';
  if (value === '') return 'http://127.0.0.1:8000';
  return value.toLowerCase() === 'off' ? null : value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  return {
    port: wholeNumber('PORT', env.PORT, 4000),
    databaseUrl: env.DATABASE_URL?.trim() || null,
    dataDir: env.DATA_DIR?.trim() || DEFAULT_DATA_DIR,
    webOrigin: env.WEB_ORIGIN?.trim() || 'http://localhost:3000',
    demoSpeed: wholeNumber('DEMO_SPEED', env.DEMO_SPEED, 30),
    alwaysOpen: (env.DEMO_ALWAYS_OPEN ?? '1') !== '0',
    demoLogin: (env.DEMO_LOGIN ?? '1') !== '0',
    adminPhone: mobile('ADMIN_PHONE', env.ADMIN_PHONE),
    paymentSandbox: (env.PAYMENT_SANDBOX ?? '1') !== '0',
    bkash: bkash(env),
    publicApiUrl:
      env.API_PUBLIC_URL?.trim().replace(/\/$/, '') ||
      `http://localhost:${wholeNumber('PORT', env.PORT, 4000)}`,
    secureCookies: production,
    mlUrl: mlUrl(env.ML_URL),
    // On a developer's machine a fixed key saves a setup step. A server must set its own.
    internalKey: env.INTERNAL_KEY?.trim() || (production ? null : 'unun-dev-key'),
    serviceFee: taka(10),
    vatRate: 0.05,
    ordersPerMinute: 12,
    quotesPerMinute: 120,
    signInsPerMinute: 20,
    paymentsPerMinute: 30,
    locationsPerMinute: 120,
    feedbackPerMinute: 10,
  };
}

/** Reads apps/api/.env into the environment, if the file exists. */
export function loadEnvFile(): void {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}
