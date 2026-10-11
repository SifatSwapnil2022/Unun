/**
 * Remembers the customer's name, number and address in this browser, so a second order
 * does not start from an empty form. Nothing here is sent anywhere until an order is placed.
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'unun.customer.v1';

export type SavedCustomer = {
  name: string;
  phone: string;
  address: string;
};

const NOTHING_SAVED: SavedCustomer = { name: '', phone: '', address: '' };

let cached: SavedCustomer | null = null;

function read(): SavedCustomer {
  if (cached) return cached;

  cached = NOTHING_SAVED;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<SavedCustomer> | null;
    if (value) {
      cached = {
        name: typeof value.name === 'string' ? value.name : '',
        phone: typeof value.phone === 'string' ? value.phone : '',
        address: typeof value.address === 'string' ? value.address : '',
      };
    }
  } catch {
    // Storage is blocked or the stored value is broken. Start with an empty form.
  }
  return cached;
}

export function saveCustomer(customer: SavedCustomer): void {
  cached = customer;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
  } catch {
    // Not remembered. The order itself is unaffected.
  }
}

const noSubscription = () => () => {};

export function useSavedCustomer(): SavedCustomer {
  return useSyncExternalStore(noSubscription, read, () => NOTHING_SAVED);
}

/** False on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
