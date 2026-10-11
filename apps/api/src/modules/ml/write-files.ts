/**
 * Writes the demo catalogue and the demo order history to services/ml/data, so the
 * Python service can be trained, tested and started with no API running.
 *
 *   pnpm ml:export
 *
 * The files are built from the seed at a fixed moment, so running this twice gives the
 * same files. Run it again after changing the seed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../config';
import { openDatabase } from '../../db/client';
import { seedDatabase } from '../../seed';
import { exportCatalogue, exportOrders } from './export';

/** A Sunday at one in the afternoon in Dhaka. */
const SEEDED_AT = new Date('2026-10-11T07:00:00Z');

const target = fileURLToPath(new URL('../../../../../services/ml/data', import.meta.url));

async function main(): Promise<void> {
  const config = loadConfig({});
  const database = await openDatabase({ databaseUrl: null, dataDir: null });

  try {
    await seedDatabase(database.db, {
      now: SEEDED_AT,
      demoAccounts: true,
      history: true,
      serviceFee: config.serviceFee,
      vatRate: config.vatRate,
    });

    const catalogue = await exportCatalogue(database.db);
    const history = await exportOrders(database.db, SEEDED_AT);
    // Oldest first, so the file reads in the order things happened.
    history.orders.reverse();

    mkdirSync(target, { recursive: true });
    writeFileSync(
      path.join(target, 'catalogue.json'),
      `${JSON.stringify(catalogue, null, 1)}\n`,
    );
    writeFileSync(
      path.join(target, 'orders.json'),
      `${JSON.stringify(history, null, 1)}\n`,
    );
    console.log(
      `Wrote ${catalogue.kitchens.length} kitchens, ${catalogue.dishes.length} dishes and ${history.orders.length} orders to ${target}`,
    );
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
