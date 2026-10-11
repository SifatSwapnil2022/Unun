import { timingSafeEqual } from 'node:crypto';
import { ApiError } from '../http/errors';
import { exportCatalogue, exportOrders } from '../modules/ml/export';
import { NO_STORE, type RouteContext } from './context';

const KEY_HEADER = 'x-internal-key';

function sameKey(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Addresses for the Python service only: the data it learns from. They are not for
 * browsers, so they take a shared key instead of a session, and without a key set they
 * do not exist.
 */
export function internalRoutes({ app, db, config, now }: RouteContext): void {
  app.use('/internal/*', async (c, next) => {
    const expected = config.internalKey;
    const given = c.req.header(KEY_HEADER) ?? '';
    if (!expected || !sameKey(given, expected)) {
      throw new ApiError('not_found', 'There is nothing at this address.');
    }
    c.header('Cache-Control', NO_STORE);
    await next();
  });

  app.get('/internal/ml/catalogue', async (c) => c.json(await exportCatalogue(db)));

  app.get('/internal/ml/orders', async (c) => c.json(await exportOrders(db, now())));
}
