import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  ORDER_STEPS,
  actorOf,
  arrivalOutcome,
  canCancel,
  canTransition,
  isFinal,
  isOpenToRiders,
  nextStatus,
  planTimeline,
} from './orders';

describe('order states', () => {
  it('move one step forward at a time', () => {
    expect(nextStatus('placed')).toBe('accepted');
    expect(canTransition('cooking', 'ready')).toBe(true);
    expect(canTransition('placed', 'cooking')).toBe(false);
    expect(canTransition('ready', 'cooking')).toBe(false);
  });

  it('end at delivered or cancelled', () => {
    expect(nextStatus('delivered')).toBeNull();
    expect(nextStatus('cancelled')).toBeNull();
    expect(isFinal('delivered')).toBe(true);
    expect(isFinal('cancelled')).toBe(true);
    expect(isFinal('picked_up')).toBe(false);
  });

  it('never step into cancelled or out of it', () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, 'cancelled')).toBe(false);
      expect(canTransition('cancelled', status)).toBe(false);
    }
  });
});

describe('who moves an order', () => {
  it('gives the kitchen the cooking steps and the rider the delivery steps', () => {
    expect(ORDER_STEPS.map(actorOf)).toEqual([
      null,
      'kitchen',
      'kitchen',
      'kitchen',
      'rider',
      'rider',
    ]);
  });

  it('offers a job to riders from the moment cooking starts until pick-up', () => {
    expect(ORDER_STATUSES.filter(isOpenToRiders)).toEqual(['cooking', 'ready']);
  });
});

describe('canCancel', () => {
  it('lets a kitchen decline only an order it has not accepted', () => {
    expect(canCancel('placed', 'kitchen')).toBe(true);
    expect(canCancel('accepted', 'kitchen')).toBe(false);
    expect(canCancel('cooking', 'kitchen')).toBe(false);
  });

  it('lets support staff cancel anything that is still on its way', () => {
    expect(canCancel('placed', 'admin')).toBe(true);
    expect(canCancel('picked_up', 'admin')).toBe(true);
    expect(canCancel('delivered', 'admin')).toBe(false);
    expect(canCancel('cancelled', 'admin')).toBe(false);
  });
});

describe('arrivalOutcome', () => {
  const window = { min: 30, max: 40 };

  it('compares the delivery minute with the promised window', () => {
    expect(arrivalOutcome(12, window)).toBe('early');
    expect(arrivalOutcome(30, window)).toBe('on_time');
    expect(arrivalOutcome(40, window)).toBe('on_time');
    expect(arrivalOutcome(41, window)).toBe('late');
  });
});

describe('planTimeline', () => {
  const window = { min: 34, max: 44 };

  it('reaches every step in order', () => {
    const plan = planTimeline({ prepMinutes: 22, window, position: 0.5, late: false });
    const minutes = ORDER_STEPS.map((step) => plan[step]);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(new Set(minutes).size).toBe(minutes.length);
  });

  it('delivers inside the window when the order is on time', () => {
    for (const position of [0, 0.25, 0.5, 0.99]) {
      const plan = planTimeline({ prepMinutes: 22, window, position, late: false });
      expect(arrivalOutcome(plan.delivered, window)).toBe('on_time');
    }
  });

  it('delivers after the window when the order is late', () => {
    const plan = planTimeline({ prepMinutes: 22, window, position: 0.3, late: true });
    expect(arrivalOutcome(plan.delivered, window)).toBe('late');
  });

  it('never delivers before the rider has had time to ride', () => {
    const plan = planTimeline({
      prepMinutes: 30,
      window: { min: 20, max: 28 },
      position: 0,
      late: false,
    });
    expect(plan.delivered).toBeGreaterThan(plan.picked_up);
  });

  it('rejects a position outside the window', () => {
    expect(() =>
      planTimeline({ prepMinutes: 10, window, position: 1, late: false }),
    ).toThrow(RangeError);
  });
});
