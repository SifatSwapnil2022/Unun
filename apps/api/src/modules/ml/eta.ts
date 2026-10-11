/**
 * Arrival windows. The plain rule in @unun/core adds cooking, riding and handing over.
 * The model in services/ml has also learned what the hour, the day and a busy kitchen
 * do to those minutes. Its answer is used when there is one and it is believable; the
 * plain rule is the fallback and the guard rail.
 */
import { deliveryWindow, dhakaMinuteOfDay, type DeliveryWindow } from '@unun/core';
import type { KitchenDelivery } from '@unun/core/contracts';
import { and, count, eq, gte, inArray } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { orders } from '../../db/schema';
import type { KitchenRow } from '../catalogue/service';
import type { DeliveryFeatures, DeliveryQuantiles, MlClient } from './client';

const MINUTE_MS = 60_000;
/** A kitchen is as busy as the orders it took in this long. */
const LOAD_WINDOW_MINUTES = 45;
/** An order of unknown size is assumed to hold this many dishes. */
export const TYPICAL_ITEMS = 2;

const CACHE_MS = 5 * MINUTE_MS;
const CACHE_ROWS = 5000;

type Cached = { window: DeliveryWindow; until: number };
const cache = new Map<string, Cached>();

/** Monday is 0, as the model was trained. Dhaka is six hours ahead of UTC all year. */
export function dhakaWeekday(now: Date): number {
  const day = new Date(now.getTime() + 6 * 60 * MINUTE_MS).getUTCDay();
  return (day + 6) % 7;
}

/**
 * Turns the model's answer into a window that can be promised. The model can be wrong
 * in ways a rule cannot, so its answer is kept near the plain rule: never under 60% of
 * the rule's earliest minute, never over 180% of its latest, and never a window so
 * narrow that an ordinary delay breaks it.
 */
export function toWindow(
  quantiles: DeliveryQuantiles,
  rule: DeliveryWindow,
): DeliveryWindow | null {
  const { p10, p90 } = quantiles;
  if (!Number.isFinite(p10) || !Number.isFinite(p90) || p10 <= 0 || p90 < p10) {
    return null;
  }

  const min = Math.max(Math.round(p10), Math.round(rule.min * 0.6), 5);
  const max = Math.min(Math.max(Math.round(p90), min + 6), Math.round(rule.max * 1.8));
  return max > min ? { min, max } : null;
}

/** How many orders each kitchen has taken in the last three quarters of an hour. */
async function loadOf(
  db: Database,
  kitchenIds: number[],
  now: Date,
): Promise<Map<number, number>> {
  const since = new Date(now.getTime() - LOAD_WINDOW_MINUTES * MINUTE_MS);
  const rows = await db
    .select({ kitchenId: orders.kitchenId, total: count() })
    .from(orders)
    .where(
      and(
        inArray(orders.kitchenId, kitchenIds),
        eq(orders.awaitingPayment, false),
        gte(orders.placedAt, since),
      ),
    )
    .groupBy(orders.kitchenId);
  return new Map(rows.map((row) => [row.kitchenId, row.total]));
}

export type EtaRequest = {
  kitchen: KitchenRow;
  km: number;
  /** Dishes in the order, when it is known. */
  items?: number;
};

export type Eta = Pick<KitchenDelivery, 'window' | 'estimate'>;

/**
 * The arrival window for each request, in the same order. One call to the model covers
 * them all, and answers are remembered for a few minutes, so a list of eighty kitchens
 * costs one round trip the first time and none after.
 */
export async function arrivalWindows(
  db: Database,
  ml: MlClient,
  requests: EtaRequest[],
  now: Date,
): Promise<Eta[]> {
  const rules = requests.map((request) =>
    deliveryWindow(request.kitchen.prepMinutes, request.km),
  );
  const byRule = (): Eta[] =>
    rules.map((window) => ({ window, estimate: 'formula' as const }));
  if (!ml.enabled || requests.length === 0) return byRule();

  const minute = dhakaMinuteOfDay(now);
  const quarter = Math.floor(minute / 15);
  const weekday = dhakaWeekday(now);
  const load = await loadOf(db, [...new Set(requests.map((r) => r.kitchen.id))], now);

  const features = requests.map((request): DeliveryFeatures => ({
    prepMinutes: request.kitchen.prepMinutes,
    km: request.km,
    hour: minute / 60,
    weekday,
    load: load.get(request.kitchen.id) ?? 0,
    items: request.items ?? TYPICAL_ITEMS,
  }));
  const keys = features.map(
    (row) =>
      `${row.prepMinutes}:${row.km}:${quarter}:${weekday}:${row.load}:${row.items}`,
  );

  const result: Array<Eta | null> = keys.map((key) => {
    const hit = cache.get(key);
    return hit && hit.until > now.getTime()
      ? { window: hit.window, estimate: 'model' as const }
      : null;
  });

  const missing = result.flatMap((eta, index) => (eta ? [] : [index]));
  if (missing.length > 0) {
    const predicted = await ml.deliveryTimes(missing.map((index) => features[index]!));
    if (!predicted) return byRule();

    if (cache.size > CACHE_ROWS) cache.clear();
    for (const [position, index] of missing.entries()) {
      const window = toWindow(predicted[position]!, rules[index]!);
      if (!window) continue;
      cache.set(keys[index]!, { window, until: now.getTime() + CACHE_MS });
      result[index] = { window, estimate: 'model' };
    }
  }

  return result.map(
    (eta, index) => eta ?? { window: rules[index]!, estimate: 'formula' },
  );
}

/** Forgets every remembered window. For tests. */
export function clearEtaCache(): void {
  cache.clear();
}
