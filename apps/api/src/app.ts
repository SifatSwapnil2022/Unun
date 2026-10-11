import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Config } from './config';
import type { Database } from './db/client';
import { ApiError } from './http/errors';
import { createSessions } from './http/session';
import { logCodeInstead, type CodeSender } from './modules/auth/service';
import { createMlClient } from './modules/ml/client';
import { createGateways } from './modules/payments/gateways';
import { accountRoutes } from './routes/account';
import { adminRoutes } from './routes/admin';
import { internalRoutes } from './routes/internal';
import { catalogueRoutes } from './routes/catalogue';
import type { RouteContext } from './routes/context';
import { orderRoutes } from './routes/orders';
import { partnerRoutes } from './routes/partner';
import { paymentRoutes } from './routes/payments';
import { riderRoutes } from './routes/rider';

export type AppDependencies = {
  db: Database;
  config: Config;
  /** The clock and the dice are injected so tests can control them. */
  now?: () => Date;
  random?: () => number;
  /** Delivers a sign-in code. Defaults to printing it, as no SMS gateway is connected. */
  sendCode?: CodeSender;
  /** How payment gateways are called. Tests pass a stand-in for bKash's servers. */
  fetch?: typeof fetch;
  /** How the Python service is called. Tests pass a stand-in. */
  mlFetch?: typeof fetch;
  /** Receives unexpected errors. Defaults to the console. */
  onUnexpectedError?: (error: unknown) => void;
};

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

export function createApp(deps: AppDependencies): Hono {
  const { db, config } = deps;
  const now = deps.now ?? (() => new Date());
  const report = deps.onUnexpectedError ?? ((error) => console.error(error));

  const app = new Hono();

  app.use(secureHeaders());
  app.use(
    cors({
      origin: config.webOrigin,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowHeaders: ['Content-Type', 'Idempotency-Key'],
      credentials: true,
      maxAge: 600,
    }),
  );
  app.use(bodyLimit({ maxSize: 32 * 1024 }));

  /*
   * Every request that changes something must say it carries JSON. A form on another
   * site cannot send that content type, and a script on another site is stopped by the
   * CORS rule above. With the session cookie's SameSite setting, that is the defence
   * against another site acting as a signed-in visitor.
   */
  app.use(async (c, next) => {
    const type = c.req.header('Content-Type') ?? '';
    if (!READ_ONLY.has(c.req.method) && !type.startsWith('application/json')) {
      throw new ApiError('invalid_request', 'Send this request as application/json.');
    }
    await next();
  });

  app.onError((error, c) => {
    if (error instanceof ApiError) return c.json(error.toBody(), error.status);

    report(error);
    const fallback = new ApiError('internal_error', 'Something went wrong on our side.');
    return c.json(fallback.toBody(), fallback.status);
  });

  app.notFound((c) =>
    c.json(new ApiError('not_found', 'There is nothing at this address.').toBody(), 404),
  );

  app.get('/health', (c) => c.json({ status: 'ok' }));

  const context: RouteContext = {
    app,
    db,
    config,
    now,
    random: deps.random ?? Math.random,
    sessions: createSessions(db, config, now),
    sendCode: deps.sendCode ?? logCodeInstead,
    payments: { config, gateways: createGateways(config, deps.fetch) },
    ml: createMlClient({
      url: config.mlUrl,
      fetch: deps.mlFetch,
      now: () => now().getTime(),
    }),
  };

  catalogueRoutes(context);
  orderRoutes(context);
  paymentRoutes(context);
  accountRoutes(context);
  partnerRoutes(context);
  riderRoutes(context);
  adminRoutes(context);
  internalRoutes(context);

  return app;
}
