/**
 * All money is held as whole paisa (1 taka = 100 paisa), never as floating-point taka,
 * so sums cannot drift and the database can store amounts as integers.
 */
export type Paisa = number;

export const TAKA: Paisa = 100;

/** Converts a taka amount to paisa: taka(49) is 4900. */
export function taka(amount: number): Paisa {
  return Math.round(amount * TAKA);
}

/** Rounds to the nearest whole taka, halves up, because customers pay in whole taka. */
export function roundToTaka(amount: number): Paisa {
  return Math.floor(amount / TAKA + 0.5) * TAKA;
}

export function assertWholeNonNegative(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a whole, non-negative number, got ${value}`);
  }
}
