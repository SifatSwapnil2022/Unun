import { riderAdvanceSchema, riderLocationSchema } from '@unun/core/contracts';
import { rateLimit } from '../http/rate-limit';
import { parse, readJson } from '../http/request';
import { advanceOrder, claimOrder } from '../modules/orders/progress';
import { getRiderBoard, reportLocation } from '../modules/rider/service';
import { NO_STORE, type RouteContext } from './context';

/** The rider's workspace. Every route needs the rider role. */
export function riderRoutes({ app, db, config, now, sessions }: RouteContext): void {
  app.get('/v1/rider/board', async (c) => {
    c.header('Cache-Control', NO_STORE);
    const rider = await sessions.requireRole(c, 'rider');
    return c.json(await getRiderBoard(db, { riderId: rider.id, now: now() }));
  });

  /** The rider's phone says where it is, while they are carrying an order. */
  app.post(
    '/v1/rider/location',
    rateLimit({ limit: config.locationsPerMinute, windowMs: 60_000 }),
    async (c) => {
      const rider = await sessions.requireRole(c, 'rider');
      const position = parse(riderLocationSchema, await readJson(c.req.raw));
      const tracked = await reportLocation(db, {
        riderId: rider.id,
        position,
        now: now(),
      });
      return c.json({ tracked });
    },
  );

  app.post('/v1/rider/orders/:publicId/claim', async (c) => {
    const rider = await sessions.requireRole(c, 'rider');
    await claimOrder(db, {
      publicId: c.req.param('publicId'),
      riderId: rider.id,
      now: now(),
    });
    return c.json({ ok: true });
  });

  app.post('/v1/rider/orders/:publicId/advance', async (c) => {
    const rider = await sessions.requireRole(c, 'rider');
    const { to } = parse(riderAdvanceSchema, await readJson(c.req.raw));
    await advanceOrder(db, {
      publicId: c.req.param('publicId'),
      to,
      actor: { kind: 'rider', riderId: rider.id },
      now: now(),
    });
    return c.json({ ok: true });
  });
}
