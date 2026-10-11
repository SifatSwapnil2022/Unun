'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  EMPTY_BAG,
  addItem,
  parseBag,
  setQuantity,
  type Bag,
  type BagItem,
  type BagKitchen,
} from '@/lib/bag';

const STORAGE_KEY = 'unun.bag.v1';

let current: Bag = EMPTY_BAG;
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    current = parseBag(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage is blocked. The bag still works for this visit; it is just not remembered.
  }
}

function commit(next: Bag): void {
  current = next;
  try {
    if (next.lines.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // See load().
  }
  for (const listener of listeners) listener();
}

/** Keeps several open tabs showing the same bag. */
function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  current = parseBag(event.newValue);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): Bag {
  load();
  return current;
}

/** The server has no bag, so the first render is always empty and hydration matches. */
const getServerSnapshot = (): Bag => EMPTY_BAG;

export function useBag() {
  const bag = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** Adds one of an item. Returns false if the bag belongs to another kitchen. */
  const add = useCallback((kitchen: BagKitchen, item: BagItem): boolean => {
    const next = addItem(getSnapshot(), kitchen, item);
    if (!next) return false;
    commit(next);
    return true;
  }, []);

  /** Empties the bag and starts a new one with this item. */
  const replaceWith = useCallback((kitchen: BagKitchen, item: BagItem): void => {
    commit(addItem(EMPTY_BAG, kitchen, item) ?? EMPTY_BAG);
  }, []);

  const change = useCallback((itemId: number, quantity: number): void => {
    commit(setQuantity(getSnapshot(), itemId, quantity));
  }, []);

  const clear = useCallback((): void => commit(EMPTY_BAG), []);

  return { bag, add, replaceWith, change, clear };
}
