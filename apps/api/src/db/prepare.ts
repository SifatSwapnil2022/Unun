import type { Config } from '../config';
import { ensureAdmin } from '../modules/auth/service';
import { seedDatabase } from '../seed';
import type { Database } from './client';

/**
 * Fills an empty database with the demo data and makes ADMIN_PHONE an admin. Safe to
 * run on every start: a database that already has data is left as it is.
 */
export async function prepareDatabase(
  db: Database,
  config: Config,
  now: Date,
): Promise<void> {
  const seeded = await seedDatabase(db, {
    now,
    demoAccounts: config.demoLogin,
    history: config.demoLogin,
    serviceFee: config.serviceFee,
    vatRate: config.vatRate,
  });
  if (seeded) {
    console.log(`Seeded ${seeded.kitchens} kitchens and ${seeded.items} menu items.`);
    if (seeded.accounts > 0) {
      console.log(
        `Seeded ${seeded.accounts} demo accounts, ${seeded.pastOrders} past orders and ${seeded.ratings} ratings.`,
      );
    }
  }

  if (config.adminPhone) await ensureAdmin(db, config.adminPhone, now);
}
