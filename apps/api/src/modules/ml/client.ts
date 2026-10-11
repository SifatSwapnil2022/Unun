/**
 * The link to the Python service in services/ml, which predicts arrival times, ranks
 * search results and suggests dishes. The service is an extra: when it is not running,
 * too slow or wrong, every call here answers null and the caller uses its own plain
 * rule instead. Nothing in the API fails because the service did.
 */
import { z } from 'zod';

export type DeliveryFeatures = {
  /** Minutes the kitchen needs to cook a typical order. */
  prepMinutes: number;
  km: number;
  /** Hour of the day in Dhaka, with the minutes as a fraction: 13.5 is half past one. */
  hour: number;
  /** 0 is Monday. In Dhaka the weekend is Friday and Saturday. */
  weekday: number;
  /** Orders the kitchen has taken in the last three quarters of an hour. */
  load: number;
  /** How many dishes are in the order. */
  items: number;
};

/** Minutes until arrival: one order in ten is faster than p10, one in ten slower than p90. */
export type DeliveryQuantiles = { p10: number; p50: number; p90: number };

export type SearchHit = { slug: string; score: number; dishes: string[] };

export type KitchenSuggestion = { slug: string; because: string | null };

const quantilesSchema = z.object({
  predictions: z.array(z.object({ p10: z.number(), p50: z.number(), p90: z.number() })),
});

const searchSchema = z.object({
  kitchens: z.array(
    z.object({ slug: z.string(), score: z.number(), dishes: z.array(z.string()) }),
  ),
});

const pairingsSchema = z.object({ dishes: z.array(z.string()) });

const suggestionsSchema = z.object({
  kitchens: z.array(z.object({ slug: z.string(), because: z.string().nullable() })),
});

const healthSchema = z.object({
  delivery: z.object({
    ready: z.boolean(),
    version: z.string().nullable(),
    trainedOn: z.string().nullable(),
  }),
  search: z.object({ kitchens: z.number(), dishes: z.number() }),
  pairings: z.object({ baskets: z.number() }),
  catalogue: z.object({ source: z.string() }),
});

export type MlHealth = z.infer<typeof healthSchema>;

export type MlClient = {
  /** False when no address is configured, so callers can skip work that feeds a call. */
  enabled: boolean;
  deliveryTimes: (orders: DeliveryFeatures[]) => Promise<DeliveryQuantiles[] | null>;
  search: (query: string) => Promise<SearchHit[] | null>;
  /** Dishes from `menu` that go with what is in `basket`, best first. */
  pairings: (basket: string[], menu: string[], limit: number) => Promise<string[] | null>;
  kitchensFor: (
    history: Array<{ dish: string; count: number }>,
    exclude: string[],
    limit: number,
  ) => Promise<KitchenSuggestion[] | null>;
  health: () => Promise<MlHealth | null>;
};

export type MlClientOptions = {
  /** The service's address, or null when it is switched off. */
  url: string | null;
  fetch?: typeof fetch;
  now?: () => number;
  /** A page must not wait for a suggestion. Past this the call is abandoned. */
  timeoutMs?: number;
  /** After a failure the service is left alone for this long. */
  restMs?: number;
  onError?: (error: unknown) => void;
};

/** The client used when the service is switched off. Every answer is "use your own rule". */
export const noMl: MlClient = {
  enabled: false,
  deliveryTimes: async () => null,
  search: async () => null,
  pairings: async () => null,
  kitchensFor: async () => null,
  health: async () => null,
};

export function createMlClient(options: MlClientOptions): MlClient {
  const { url, timeoutMs = 700, restMs = 15_000 } = options;
  if (!url) return noMl;

  const call = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const report = options.onError ?? (() => {});
  let restingUntil = 0;

  /**
   * One request. A failure of any kind (refused, slow, an error status, an answer in
   * the wrong shape) is reported, starts a short rest, and comes back as null.
   */
  async function ask<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T | null> {
    if (now() < restingUntil) return null;

    try {
      const response = await call(`${url}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`The ML service answered ${response.status}`);
      return schema.parse(await response.json());
    } catch (error) {
      restingUntil = now() + restMs;
      report(error);
      return null;
    }
  }

  return {
    enabled: true,

    async deliveryTimes(orders) {
      if (orders.length === 0) return [];
      const answer = await ask('/v1/delivery-time', quantilesSchema, {
        orders: orders.map((order) => ({
          prep_minutes: order.prepMinutes,
          km: order.km,
          hour: order.hour,
          weekday: order.weekday,
          load: order.load,
          items: order.items,
        })),
      });
      // An answer for a different number of orders cannot be matched up, so it is no answer.
      return answer?.predictions.length === orders.length ? answer.predictions : null;
    },

    async search(query) {
      const answer = await ask(
        `/v1/search?q=${encodeURIComponent(query)}&limit=60`,
        searchSchema,
      );
      return answer?.kitchens ?? null;
    },

    async pairings(basket, menu, limit) {
      const answer = await ask('/v1/pairings', pairingsSchema, { basket, menu, limit });
      return answer?.dishes ?? null;
    },

    async kitchensFor(history, exclude, limit) {
      const answer = await ask('/v1/kitchens-for', suggestionsSchema, {
        history,
        exclude,
        limit,
      });
      return answer?.kitchens ?? null;
    },

    health: () => ask('/health', healthSchema),
  };
}
