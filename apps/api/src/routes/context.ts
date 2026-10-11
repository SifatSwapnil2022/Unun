import type { Hono } from 'hono';
import type { Config } from '../config';
import type { Database } from '../db/client';
import type { Sessions } from '../http/session';
import type { CodeSender } from '../modules/auth/service';
import type { MlClient } from '../modules/ml/client';
import type { PaymentDeps } from '../modules/payments/service';

/** What every group of routes is given. */
export type RouteContext = {
  app: Hono;
  db: Database;
  config: Config;
  now: () => Date;
  random: () => number;
  sessions: Sessions;
  sendCode: CodeSender;
  /** The payment gateways, and the settings they need. */
  payments: PaymentDeps;
  /** The Python service that predicts, searches and suggests. It may not be running. */
  ml: MlClient;
};

/** Answers that describe one person's work must never be kept by a cache. */
export const NO_STORE = 'no-store';
