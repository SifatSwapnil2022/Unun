import {
  issueRequestSchema,
  orderRequestSchema,
  quoteRequestSchema,
  ratingRequestSchema,
} from '@unun/core/contracts';
import { rateLimit } from '../http/rate-limit';
import { parse, readJson } from '../http/request';
import { rateOrder, reportIssue } from '../modules/feedback/service';
import { buildQuote } from '../modules/orders/quote';
import { getOrder, placeOrder } from '../modules/orders/service';
import { NO_STORE, type RouteContext } from './context';

export function orderRoutes(context: RouteContext): void {
  const { app, db, config, ml, now, random, sessions, payments } = context;

  app.post(
    '/v1/quotes',
    rateLimit({ limit: config.quotesPerMinute, windowMs: 60_000 }),
    async (c) => {
      const request = parse(quoteRequestSchema, await readJson(c.req.raw));
      const { quote } = await buildQuote(db, { config, ml }, request, now());
      return c.json(quote);
    },
  );

  app.post(
    '/v1/orders',
    rateLimit({ limit: config.ordersPerMinute, windowMs: 60_000 }),
    async (c) => {
      const request = parse(orderRequestSchema, await readJson(c.req.raw));
      const key = c.req.header('Idempotency-Key')?.trim().slice(0, 80) || null;
      // Signing in is optional. An order placed while signed in joins the account.
      const user = await sessions.current(c);
      const created = await placeOrder(
        db,
        { ...payments, ml },
        {
          request,
          userId: user?.id ?? null,
          idempotencyKey: key,
          now: now(),
          random,
        },
      );
      return c.json(created, 201);
    },
  );

  app.get('/v1/orders/:token', async (c) => {
    c.header('Cache-Control', NO_STORE);
    return c.json(await getOrder(db, c.req.param('token'), now()));
  });

  // Whoever holds an order's link may rate it or report a problem with it, signed in
  // or not: the link is what was given to the person who ordered.
  const feedbackLimit = rateLimit({ limit: config.feedbackPerMinute, windowMs: 60_000 });

  app.post('/v1/orders/:token/rating', feedbackLimit, async (c) => {
    const token = c.req.param('token');
    const rating = parse(ratingRequestSchema, await readJson(c.req.raw));
    await rateOrder(db, { token, ...rating, now: now() });
    return c.json(await getOrder(db, token, now()), 201);
  });

  app.post('/v1/orders/:token/issues', feedbackLimit, async (c) => {
    const token = c.req.param('token');
    const report = parse(issueRequestSchema, await readJson(c.req.raw));
    await reportIssue(db, { token, ...report, now: now() });
    return c.json(await getOrder(db, token, now()), 201);
  });
}
