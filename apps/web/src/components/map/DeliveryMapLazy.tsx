'use client';

import dynamic from 'next/dynamic';
import type { DeliveryMapProps } from './DeliveryMap';

/*
 * The map library needs a browser, and it is only wanted on two screens. It is loaded
 * there, in the browser, and nowhere else.
 */
const DeliveryMap = dynamic(() => import('./DeliveryMap'), {
  ssr: false,
  loading: () => <div className="delivery-map" />,
});

export function DeliveryMapLazy(props: DeliveryMapProps) {
  return <DeliveryMap {...props} />;
}
