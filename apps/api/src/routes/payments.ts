import { sandboxOutcomeSchema } from '@unun/core/contracts';
import { rateLimit } from '../http/rate-limit';
import { parse, readJson } from '../http/request';
import {
  getPayment,
  retryPayment,
  settleBkash,
  settleSandbox,
} from '../modules/payments/service';
import { NO_STORE, type RouteContext } from './context';

export function paymentRoutes(context: RouteContext): void {
  const { app, db, config, now, random, payments } = context;
  const limit = rateLimit({ limit: config.paymentsPerMinute, windowMs: 60_000 });

  /** The ways to pay that are on offer right now. */
  app.get('/v1/payment-options', (c) => c.json(payments.gateways.options()));

  /*
   * bKash sends the customer's browser here when they are done. The answer is a
   * redirect to the order's page; what that page shows comes from asking bKash.
   */
  app.get('/v1/payments/bkash/callback', limit, async (c) => {
    const paymentId = c.req.query('paymentID') ?? '';
    const { orderToken, locale } = await settleBkash(db, payments, {
      paymentId,
      status: c.req.query('status') ?? '',
      now: now(),
      random,
    });
    return c.redirect(`${config.webOrigin}/${locale}/orders/${orderToken}`, 303);
  });

  app.get('/v1/payments/:token', async (c) => {
    c.header('Cache-Control', NO_STORE);
    return c.json(await getPayment(db, c.req.param('token'), now()));
  });

  /** The test gateway's page reports what the visitor chose. */
  app.post('/v1/payments/:token/sandbox', limit, async (c) => {
    const { outcome } = parse(sandboxOutcomeSchema, await readJson(c.req.raw));
    const payment = await settleSandbox(db, payments, {
      token: c.req.param('token'),
      outcome,
      now: now(),
      random,
    });
    return c.json(payment);
  });

  /** Starts a new attempt for an order whose last payment failed or was abandoned. */
  app.post('/v1/orders/:token/pay', limit, async (c) => {
    const open = await retryPayment(db, payments, {
      orderToken: c.req.param('token'),
      now: now(),
    });
    return c.json(open, 201);
  });
}
