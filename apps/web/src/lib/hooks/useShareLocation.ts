'use client';

import type { LatLng } from '@unun/core';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/** A rider's phone reports where it is this often while they carry an order. */
const SEND_EVERY_MS = 5000;

/**
 * Shares the rider's position while they have a delivery. The browser asks for
 * permission the first time. If it is refused, or the device has no location, nothing
 * is sent and the customer's map falls back to an estimate.
 */
export function useShareLocation(active: boolean): LatLng | null {
  const [position, setPosition] = useState<LatLng | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!active || !('geolocation' in navigator)) return;

    const watch = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const here = { lat: coords.latitude, lng: coords.longitude };
        setPosition(here);

        const now = Date.now();
        if (now - lastSent.current < SEND_EVERY_MS) return;
        lastSent.current = now;
        // A report that fails is simply followed by the next one.
        api.reportLocation(here).catch(() => {});
      },
      () => setPosition(null),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watch);
      setPosition(null);
    };
  }, [active]);

  return position;
}
