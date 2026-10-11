'use client';

import type { LatLng } from '@unun/core';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

export type MapPlace = { position: LatLng; label: string };

export type DeliveryMapProps = {
  kitchen: MapPlace;
  destination: MapPlace;
  /** Where the rider is, once there is something to show. */
  rider: MapPlace | null;
  /** What the map is, for people who cannot see it. */
  label: string;
  className?: string;
};

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const EMBER = '#ff5b1f';
const SOOT = '#16120e';

/** Where a pin's name sits, so that two names never land on top of each other. */
type Side = 'above' | 'below' | 'beside';

/** The end further north carries its name above the dot, the other one below. */
function endSides(kitchen: LatLng, door: LatLng): { kitchen: Side; door: Side } {
  return kitchen.lat > door.lat
    ? { kitchen: 'above', door: 'below' }
    : { kitchen: 'below', door: 'above' };
}

/**
 * The rider is somewhere between the two ends. On a route that runs up the map the name
 * goes beside the dot. On one that runs across, it goes on the side the nearer end's
 * name has left free.
 */
function riderSide(kitchen: LatLng, door: LatLng, rider: LatLng): Side {
  const across = Math.cos((kitchen.lat * Math.PI) / 180);
  const tall = Math.abs(kitchen.lat - door.lat);
  const wide = Math.abs(kitchen.lng - door.lng) * across;
  if (tall >= wide) return 'beside';

  const [north, south] = kitchen.lat > door.lat ? [kitchen, door] : [door, kitchen];
  const nearerNorth = Math.abs(rider.lng - north.lng) < Math.abs(rider.lng - south.lng);
  return nearerNorth ? 'below' : 'above';
}

/**
 * A marker made of a dot on the spot and a name next to it. The name is set as text, not
 * as markup, so a kitchen's or a rider's name can never be read as code.
 */
function pin(kind: 'kitchen' | 'door' | 'rider', label: string, side: Side): L.DivIcon {
  const element = document.createElement('span');
  element.className = `map-pin map-pin-${kind}`;
  const name = document.createElement('span');
  name.className = `map-pin-name map-pin-name-${side}`;
  name.textContent = label;
  element.append(name);
  return L.divIcon({ html: element, className: 'map-pin-anchor', iconSize: [0, 0] });
}

/**
 * The delivery on a map: the kitchen, the customer's area, the line between them and
 * the rider. The map is an extra: every fact on it is also written on the page.
 */
export default function DeliveryMap({
  kitchen,
  destination,
  rider,
  label,
  className = '',
}: DeliveryMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const riderMarker = useRef<L.Marker | null>(null);
  /** The name and side the rider's pin was last drawn with. */
  const riderDrawn = useRef<string | null>(null);
  const travelled = useRef<L.Polyline | null>(null);

  const kitchenLat = kitchen.position.lat;
  const kitchenLng = kitchen.position.lng;
  const doorLat = destination.position.lat;
  const doorLng = destination.position.lng;

  useEffect(() => {
    const node = container.current;
    if (!node) return;

    const from: L.LatLngTuple = [kitchenLat, kitchenLng];
    const to: L.LatLngTuple = [doorLat, doorLng];

    const created = L.map(node, {
      // The page scrolls past the map. It must not catch the wheel or a swipe.
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      zoomSnap: 0.25,
    });
    created.attributionControl.setPrefix(false);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(created);

    L.polyline([from, to], {
      color: SOOT,
      weight: 3,
      opacity: 0.55,
      dashArray: '1 9',
      lineCap: 'round',
    }).addTo(created);
    travelled.current = L.polyline([from, from], {
      color: EMBER,
      weight: 5,
      lineCap: 'round',
    }).addTo(created);

    const sides = endSides(
      { lat: kitchenLat, lng: kitchenLng },
      { lat: doorLat, lng: doorLng },
    );
    L.marker(from, {
      icon: pin('kitchen', kitchen.label, sides.kitchen),
      keyboard: false,
    }).addTo(created);
    L.marker(to, {
      icon: pin('door', destination.label, sides.door),
      keyboard: false,
    }).addTo(created);
    created.fitBounds(L.latLngBounds([from, to]), { padding: [64, 72], maxZoom: 15 });

    map.current = created;
    return () => {
      created.remove();
      map.current = null;
      riderMarker.current = null;
      riderDrawn.current = null;
      travelled.current = null;
    };
    // Labels belong to the places. A new place is a new map; a new word is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitchenLat, kitchenLng, doorLat, doorLng]);

  const riderLat = rider?.position.lat ?? null;
  const riderLng = rider?.position.lng ?? null;
  const riderLabel = rider?.label ?? '';

  useEffect(() => {
    const current = map.current;
    if (!current) return;

    if (riderLat === null || riderLng === null) {
      riderMarker.current?.remove();
      riderMarker.current = null;
      riderDrawn.current = null;
      travelled.current?.setLatLngs([
        [kitchenLat, kitchenLng],
        [kitchenLat, kitchenLng],
      ]);
      return;
    }

    const here: L.LatLngTuple = [riderLat, riderLng];
    const side = riderSide(
      { lat: kitchenLat, lng: kitchenLng },
      { lat: doorLat, lng: doorLng },
      { lat: riderLat, lng: riderLng },
    );
    const icon = pin('rider', riderLabel, side);
    const drawn = `${side}:${riderLabel}`;

    if (!riderMarker.current) {
      riderMarker.current = L.marker(here, {
        icon,
        keyboard: false,
        zIndexOffset: 500,
      }).addTo(current);
    } else {
      riderMarker.current.setLatLng(here);
      if (riderDrawn.current !== drawn) riderMarker.current.setIcon(icon);
    }
    riderDrawn.current = drawn;
    travelled.current?.setLatLngs([[kitchenLat, kitchenLng], here]);
  }, [riderLat, riderLng, riderLabel, kitchenLat, kitchenLng, doorLat, doorLng]);

  return (
    <div
      ref={container}
      role="group"
      aria-label={label}
      className={`delivery-map ${className}`}
    />
  );
}
