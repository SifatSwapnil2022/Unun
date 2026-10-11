/**
 * The rider's workspace: the delivery they are on, the ones waiting for someone, and
 * what they have done today.
 */
import { cashToCollect, dhakaDayStart, isOpenToRiders, type LatLng } from '@unun/core';
import type { RiderBoard } from '@unun/core/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { orders } from '../../db/schema';
import { finished, inProgress, loadOrders, toWorkOrder } from '../orders/read';

export async function getRiderBoard(
  db: Database,
  input: { riderId: number; now: Date },
): Promise<RiderBoard> {
  const { riderId, now } = input;
  const mine = eq(orders.riderId, riderId);

  const [active, waiting, done] = await Promise.all([
    loadOrders(db, now, { where: and(mine, inProgress(db, now)), limit: 1 }),
    loadOrders(db, now, {
      where: and(
        eq(orders.autopilot, false),
        isNull(orders.riderId),
        inProgress(db, now),
      ),
      limit: 60,
    }),
    loadOrders(db, now, {
      where: and(mine, finished(db, now)),
      newestFirst: true,
      limit: 60,
    }),
  ]);

  const dayStart = dhakaDayStart(now).getTime();
  const deliveredToday = done.filter((view) => {
    const delivered = view.events.find((event) => event.status === 'delivered');
    return delivered !== undefined && delivered.at.getTime() >= dayStart;
  });

  const [current] = active;
  return {
    // The rider needs the customer's number once the order is theirs to deliver.
    active: current ? toWorkOrder(current, { showPhone: true }) : null,
    available: waiting
      .filter((view) => isOpenToRiders(view.status))
      .map((view) => toWorkOrder(view, { showPhone: false })),
    recent: done.slice(0, 10).map((view) => toWorkOrder(view, { showPhone: false })),
    today: {
      deliveries: deliveredToday.length,
      earned: deliveredToday.reduce((sum, view) => sum + view.order.deliveryFee, 0),
      // Orders paid online put no cash in the rider's hands.
      cashCollected: deliveredToday.reduce(
        (sum, view) => sum + cashToCollect(view.order.paymentMethod, view.order.total),
        0,
      ),
    },
  };
}

/**
 * Stores where the rider's phone says it is, on the order they are carrying. Returns
 * false when they are carrying nothing, so the phone can stop reporting.
 */
export async function reportLocation(
  db: Database,
  input: { riderId: number; position: LatLng; now: Date },
): Promise<boolean> {
  const { riderId, position, now } = input;
  const updated = await db
    .update(orders)
    .set({ riderLat: position.lat, riderLng: position.lng, riderAt: now })
    .where(and(eq(orders.riderId, riderId), inProgress(db, now)))
    .returning({ id: orders.id });
  return updated.length > 0;
}
