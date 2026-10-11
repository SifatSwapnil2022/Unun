import { describe, expect, it } from 'vitest';
import {
  MAX_DELIVERY_KM,
  deliveryFeeFor,
  deliveryWindow,
  roadKm,
  straightLineKm,
  pointBetween,
  rideMinutes,
} from './delivery';
import { taka } from './money';

const dhanmondi = { lat: 23.7461, lng: 90.3742 };
const gulshan = { lat: 23.7925, lng: 90.4078 };
const uttara = { lat: 23.8759, lng: 90.3795 };

describe('straightLineKm', () => {
  it('is zero between a point and itself', () => {
    expect(straightLineKm(dhanmondi, dhanmondi)).toBe(0);
  });

  it('measures Dhanmondi to Gulshan at about six kilometres', () => {
    const km = straightLineKm(dhanmondi, gulshan);
    expect(km).toBeGreaterThan(5.5);
    expect(km).toBeLessThan(6.7);
  });

  it('is the same in both directions', () => {
    expect(straightLineKm(dhanmondi, uttara)).toBeCloseTo(
      straightLineKm(uttara, dhanmondi),
      10,
    );
  });
});

describe('roadKm', () => {
  it('is longer than the straight line and has one decimal place', () => {
    const km = roadKm(dhanmondi, gulshan);
    expect(km).toBeGreaterThan(straightLineKm(dhanmondi, gulshan));
    expect(Number.isInteger(km * 10)).toBe(true);
  });
});

describe('deliveryFeeFor', () => {
  it('charges by distance tier', () => {
    expect(deliveryFeeFor(0)).toBe(taka(29));
    expect(deliveryFeeFor(2)).toBe(taka(29));
    expect(deliveryFeeFor(2.1)).toBe(taka(39));
    expect(deliveryFeeFor(5)).toBe(taka(49));
    expect(deliveryFeeFor(MAX_DELIVERY_KM)).toBe(taka(59));
  });

  it('returns null beyond the delivery range', () => {
    expect(deliveryFeeFor(MAX_DELIVERY_KM + 0.1)).toBeNull();
    expect(deliveryFeeFor(roadKm(dhanmondi, uttara))).toBeNull();
  });

  it('rejects a negative distance', () => {
    expect(() => deliveryFeeFor(-1)).toThrow(RangeError);
  });
});

describe('deliveryWindow', () => {
  it('covers cooking, the ride and the handover', () => {
    // 22 min cooking + 3 km at 4 min/km + 4 min handover = 38 min expected.
    expect(deliveryWindow(22, 3)).toEqual({ min: 34, max: 44 });
  });

  it('is always at least eight minutes wide', () => {
    const window = deliveryWindow(8, 0.5);
    expect(window.max - window.min).toBeGreaterThanOrEqual(8);
  });

  it('gets later as the distance grows', () => {
    expect(deliveryWindow(20, 6).min).toBeGreaterThan(deliveryWindow(20, 2).min);
  });
});

describe('pointBetween', () => {
  const kitchen = { lat: 23.71, lng: 90.4 };
  const door = { lat: 23.75, lng: 90.38 };

  it('starts at one end and finishes at the other', () => {
    expect(pointBetween(kitchen, door, 0)).toEqual(kitchen);
    expect(pointBetween(kitchen, door, 1)).toEqual(door);
  });

  it('is halfway at a half', () => {
    const middle = pointBetween(kitchen, door, 0.5);
    expect(middle.lat).toBeCloseTo(23.73, 6);
    expect(middle.lng).toBeCloseTo(90.39, 6);
  });

  it('never leaves the line', () => {
    expect(pointBetween(kitchen, door, -2)).toEqual(kitchen);
    expect(pointBetween(kitchen, door, 5)).toEqual(door);
  });
});

describe('rideMinutes', () => {
  it('takes four minutes for each kilometre of road', () => {
    const from = { lat: 23.7461, lng: 90.3742 };
    const to = { lat: 23.7925, lng: 90.4078 };
    expect(rideMinutes(from, to)).toBeCloseTo(roadKm(from, to) * 4, 6);
  });
});
