/**
 * A customer's saved delivery addresses.
 */
import type { AddressDto, AddressRequest } from '@unun/core/contracts';
import { and, asc, count, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { addresses, areas } from '../../db/schema';
import { ApiError } from '../../http/errors';

/** Enough for home, work and a few relatives. */
export const MAX_ADDRESSES = 6;

export async function listAddresses(db: Database, userId: number): Promise<AddressDto[]> {
  const rows = await db
    .select({ address: addresses, area: areas })
    .from(addresses)
    .innerJoin(areas, eq(areas.id, addresses.areaId))
    .where(eq(addresses.userId, userId))
    .orderBy(asc(addresses.id));

  return rows.map(({ address, area }) => ({
    id: address.id,
    label: address.label,
    area: { id: area.id, name: { en: area.nameEn, bn: area.nameBn } },
    line: address.line,
  }));
}

export async function addAddress(
  db: Database,
  userId: number,
  request: AddressRequest,
  now: Date,
): Promise<AddressDto[]> {
  const [area] = await db.select().from(areas).where(eq(areas.id, request.area)).limit(1);
  if (!area) {
    throw new ApiError('unknown_area', `There is no delivery area "${request.area}".`);
  }

  const [saved] = await db
    .select({ total: count() })
    .from(addresses)
    .where(eq(addresses.userId, userId));
  if ((saved?.total ?? 0) >= MAX_ADDRESSES) {
    throw new ApiError(
      'limit_reached',
      `You can save up to ${MAX_ADDRESSES} addresses. Remove one to add another.`,
    );
  }

  await db.insert(addresses).values({
    userId,
    label: request.label,
    areaId: area.id,
    line: request.line,
    createdAt: now,
  });
  return listAddresses(db, userId);
}

export async function removeAddress(
  db: Database,
  userId: number,
  addressId: number,
): Promise<AddressDto[]> {
  // The owner is part of the condition, so nobody can remove another person's address.
  await db
    .delete(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));
  return listAddresses(db, userId);
}
