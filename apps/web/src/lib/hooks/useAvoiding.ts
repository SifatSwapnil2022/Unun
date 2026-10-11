'use client';

import { isAllergen, sortAllergens, type Allergen } from '@unun/core';
import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'unun.avoid.v1';
const NOTHING: Allergen[] = [];

let current: Allergen[] = NOTHING;
let loaded = false;
const listeners = new Set<() => void>();

/** Reads a stored list, keeping only the allergens this version knows. */
export function parseAvoiding(text: string | null): Allergen[] {
  if (!text) return NOTHING;
  try {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) return NOTHING;
    const known = value.filter(
      (entry): entry is Allergen => typeof entry === 'string' && isAllergen(entry),
    );
    return known.length === 0 ? NOTHING : sortAllergens(known);
  } catch {
    return NOTHING;
  }
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    current = parseAvoiding(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage is blocked. The choice still works on this page; it is just not kept.
  }
}

function commit(next: Allergen[]): void {
  current = next.length === 0 ? NOTHING : next;
  try {
    if (next.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // See load().
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Allergen[] {
  load();
  return current;
}

/** The server does not know what the visitor avoids, so the first render hides nothing. */
const getServerSnapshot = (): Allergen[] => NOTHING;

/**
 * What this visitor avoids eating. It is remembered in the browser, so it follows them
 * from one kitchen's menu to the next, and it is never sent to the server.
 */
export function useAvoiding() {
  const avoiding = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((allergen: Allergen): void => {
    const now = getSnapshot();
    commit(
      now.includes(allergen)
        ? now.filter((entry) => entry !== allergen)
        : sortAllergens([...now, allergen]),
    );
  }, []);

  const clear = useCallback((): void => commit([]), []);

  return { avoiding, toggle, clear };
}
