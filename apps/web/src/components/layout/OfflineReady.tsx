'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that shows an "offline" page when the network is gone.
 * Only in a production build: in development a worker would sit between the browser and
 * every reload.
 */
export function OfflineReady() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    // If it cannot be registered the site works as before, just without that page.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
