import type { Context, MiddlewareHandler } from 'hono';
import { ApiError } from './errors';

type Bucket = { count: number; resetAt: number };

function clientKey(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;

  // Set by the Node adapter. Absent when the app is called directly, as tests do.
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } })
    ?.incoming;
  return incoming?.socket?.remoteAddress ?? 'local';
}

/**
 * A fixed-window limit per client address, kept in memory. It is enough for one API
 * process; several processes would need a shared store such as Redis.
 */
export function rateLimit(options: {
  limit: number;
  windowMs: number;
}): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();

  return async (c, next) => {
    const now = Date.now();
    const key = clientKey(c);
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
      // Drop expired buckets so the map cannot grow without limit.
      if (buckets.size > 10_000) {
        for (const [other, value] of buckets) {
          if (value.resetAt <= now) buckets.delete(other);
        }
      }
    }

    bucket.count += 1;
    if (bucket.count > options.limit) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      throw new ApiError('rate_limited', 'Too many requests. Please wait a moment.');
    }

    await next();
  };
}
