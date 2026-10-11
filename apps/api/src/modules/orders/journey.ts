/**
 * Starting an order's journey: the moment the kitchen is told. For cash that is when
 * the order is placed; for an online payment it is when the money arrives.
 */
import { ORDER_STEPS, planTimeline } from '@unun/core';
import type { Transaction } from '../../db/client';
import { orderEvents } from '../../db/schema';

const MINUTE_MS = 60_000;

export type JourneyInput = {
  order: {
    id: number;
    autopilot: boolean;
    timeScale: number;
    windowMin: number;
    windowMax: number;
  };
  kitchen: { prepMinutes: number; onTimeOfTen: number };
  now: Date;
  /** A number in [0, 1). Injected so tests can decide where an order lands. */
  random: () => number;
};

/**
 * Stores "placed", and on autopilot the rest of the journey too, each step with the
 * moment it is reached. A kitchen run by hand adds its own steps (see progress.ts).
 */
export async function startJourney(tx: Transaction, input: JourneyInput): Promise<void> {
  const { order, kitchen, now, random } = input;

  // Whether the order arrives inside its window is drawn against the kitchen's record.
  const late = random() >= kitchen.onTimeOfTen / 10;
  const timeline = planTimeline({
    prepMinutes: kitchen.prepMinutes,
    window: { min: order.windowMin, max: order.windowMax },
    position: random(),
    late,
  });

  const steps = order.autopilot ? ORDER_STEPS : (['placed'] as const);
  await tx.insert(orderEvents).values(
    steps.map((status) => ({
      orderId: order.id,
      status,
      minute: timeline[status],
      at: new Date(now.getTime() + (timeline[status] * MINUTE_MS) / order.timeScale),
    })),
  );
}
