'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** After this many failed checks in a row a screen says its updates have stopped. */
export const FAILURES_BEFORE_WARNING = 3;

/**
 * Keeps a piece of data fresh by asking for it again every few seconds while the tab
 * is visible. `load` must keep the same identity between renders (wrap it in
 * useCallback), or the timer restarts on every render.
 */
export function usePolling<T>(load: () => Promise<T>, initial: T, intervalMs = 3000) {
  const [data, setData] = useState(initial);
  const [failures, setFailures] = useState(0);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const request = (latest.current += 1);
    try {
      const next = await load();
      // An answer that was overtaken by a newer request is thrown away.
      if (request === latest.current) {
        setData(next);
        setFailures(0);
      }
    } catch {
      if (request === latest.current) setFailures((count) => count + 1);
    }
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [refresh, intervalMs]);

  return { data, setData, refresh, stale: failures >= FAILURES_BEFORE_WARNING };
}
