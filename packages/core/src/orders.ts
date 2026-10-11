/**
 * Order states. An order moves one step forward at a time: it never skips a step and
 * never goes back. The one way off that path is cancelling, which ends the order.
 */
import type { DeliveryWindow } from './delivery';

/** The steps of a delivered order, in the order they happen. */
export const ORDER_STEPS = [
  'placed',
  'accepted',
  'cooking',
  'ready',
  'picked_up',
  'delivered',
] as const;

export type OrderStep = (typeof ORDER_STEPS)[number];

export const ORDER_STATUSES = [...ORDER_STEPS, 'cancelled'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function nextStatus(status: OrderStatus): OrderStep | null {
  if (status === 'cancelled') return null;
  return ORDER_STEPS[ORDER_STEPS.indexOf(status) + 1] ?? null;
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return nextStatus(from) === to;
}

/** True once nothing more can happen to the order. */
export function isFinal(status: OrderStatus): boolean {
  return status === 'delivered' || status === 'cancelled';
}

/** The people who move an order along once the customer has placed it. */
export type OrderActor = 'kitchen' | 'rider';

/** Who moves an order into a step. Nobody moves it into "placed": the customer did. */
export function actorOf(step: OrderStep): OrderActor | null {
  switch (step) {
    case 'placed':
      return null;
    case 'accepted':
    case 'cooking':
    case 'ready':
      return 'kitchen';
    case 'picked_up':
    case 'delivered':
      return 'rider';
  }
}

/**
 * Whether an order can still be cancelled. A kitchen may decline an order it has not
 * accepted yet. Support staff may cancel anything that has not been delivered.
 */
export function canCancel(status: OrderStatus, by: 'kitchen' | 'admin'): boolean {
  return by === 'kitchen' ? status === 'placed' : !isFinal(status);
}

/**
 * Reasons the system gives when it cancels an order by itself. They are stored as codes
 * and shown in the reader's language, unlike a reason typed by a person.
 */
export const SYSTEM_REASONS = {
  paymentTimeout: 'system:payment_timeout',
} as const;

export type SystemReason = (typeof SYSTEM_REASONS)[keyof typeof SYSTEM_REASONS];

export function isSystemReason(reason: string | null): reason is SystemReason {
  return Object.values(SYSTEM_REASONS).includes(reason as SystemReason);
}

/**
 * A rider can take a job once the kitchen has started cooking, so they reach the
 * kitchen as the food comes off the stove.
 */
export function isOpenToRiders(status: OrderStatus): boolean {
  return status === 'cooking' || status === 'ready';
}

/** How a delivery compares with the arrival window the customer was promised. */
export type ArrivalOutcome = 'early' | 'on_time' | 'late';

export function arrivalOutcome(
  deliveredMinute: number,
  window: DeliveryWindow,
): ArrivalOutcome {
  if (deliveredMinute > window.max) return 'late';
  return deliveredMinute < window.min ? 'early' : 'on_time';
}

/** Minutes after the order is placed at which each step is reached. */
export type OrderTimeline = Record<OrderStep, number>;

/**
 * Plans when an order reaches each step. Kitchens on autopilot have no staff pressing
 * buttons, so the demo simulator plays this plan back.
 *
 * `position` chooses where in the arrival window the order lands: 0 is the earliest
 * minute, just under 1 is the latest. A late order arrives after the window closes.
 */
export function planTimeline(input: {
  prepMinutes: number;
  window: DeliveryWindow;
  position: number;
  late: boolean;
}): OrderTimeline {
  const { prepMinutes, window, position, late } = input;
  if (position < 0 || position >= 1) {
    throw new RangeError(`position must be in [0, 1), got ${position}`);
  }

  const ready = Math.max(prepMinutes, 3);
  const pickedUp = ready + 3;
  const arrival = late
    ? window.max + 3 + Math.round(position * 6)
    : window.min + Math.floor(position * (window.max - window.min + 1));

  return {
    placed: 0,
    accepted: 1,
    cooking: 2,
    ready,
    picked_up: pickedUp,
    // The ride takes at least two minutes, however early the window opens.
    delivered: Math.max(arrival, pickedUp + 2),
  };
}
