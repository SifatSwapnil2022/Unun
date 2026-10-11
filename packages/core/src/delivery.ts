/**
 * Delivery distance, fee and time window. The window is a range on purpose: one number
 * would be a promise the road cannot keep.
 */
import { taka, type Paisa } from './money';

export type LatLng = { lat: number; lng: number };

export type DeliveryWindow = {
  /** Earliest and latest arrival, in minutes after the order is placed. */
  min: number;
  max: number;
};

const EARTH_RADIUS_KM = 6371;

/** Roads are longer than the straight line. 1.35 is a usual detour factor for a dense city grid. */
const DETOUR_FACTOR = 1.35;

/** Riders average roughly 15 km/h through Dhaka traffic. */
export const MINUTES_PER_KM = 4;

/** Finding the door, handing over the food and taking payment. */
const HANDOVER_MINUTES = 4;

/** Beyond this the food arrives cold, so the kitchen is not offered. */
export const MAX_DELIVERY_KM = 9;

const FEE_TIERS: ReadonlyArray<{ upToKm: number; fee: Paisa }> = [
  { upToKm: 2, fee: taka(29) },
  { upToKm: 4, fee: taka(39) },
  { upToKm: 6.5, fee: taka(49) },
  { upToKm: MAX_DELIVERY_KM, fee: taka(59) },
];

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres (haversine). */
export function straightLineKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Estimated distance by road, rounded to one decimal place. */
export function roadKm(from: LatLng, to: LatLng): number {
  return Math.round(straightLineKm(from, to) * DETOUR_FACTOR * 10) / 10;
}

/** The delivery fee for a road distance, or null when the address is out of range. */
export function deliveryFeeFor(km: number): Paisa | null {
  if (km < 0) throw new RangeError(`distance must not be negative, got ${km}`);
  return FEE_TIERS.find((tier) => km <= tier.upToKm)?.fee ?? null;
}

/**
 * The arrival window: cooking time plus the ride plus the handover, then a margin that
 * leans late, because late is the direction delivery estimates go wrong.
 */
export function deliveryWindow(prepMinutes: number, km: number): DeliveryWindow {
  const expected = prepMinutes + km * MINUTES_PER_KM + HANDOVER_MINUTES;
  const min = Math.round(expected * 0.9);
  const max = Math.max(Math.round(expected * 1.15), min + 8);
  return { min, max };
}

/**
 * The point a given share of the way from one place to another, in a straight line.
 * Used to show roughly where a rider is when their phone has not said.
 */
export function pointBetween(from: LatLng, to: LatLng, share: number): LatLng {
  const t = Math.min(Math.max(share, 0), 1);
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

/** Minutes a rider needs for the road distance between two places. */
export function rideMinutes(from: LatLng, to: LatLng): number {
  return roadKm(from, to) * MINUTES_PER_KM;
}
