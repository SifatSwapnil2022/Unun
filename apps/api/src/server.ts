import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig, loadEnvFile } from './config';
import { openDatabase } from './db/client';
import { ensureAdmin } from './modules/auth/service';
import { discardStaleData, recordSeedVersion } from './db/embedded';
import { SEED_VERSION, seedDatabase } from './seed';

async function main(): Promise<void> {
  loadEnvFile();
  const config = loadConfig();

  const embedded = config.databaseUrl === null;
  if (embedded && discardStaleData(config.dataDir, SEED_VERSION)) {
    console.log('The demo data has changed, so the embedded database is being rebuilt.');
  }

  const database = await openDatabase({
    databaseUrl: config.databaseUrl,
    dataDir: config.dataDir,
  });

  const seeded = await seedDatabase(database.db, {
    now: new Date(),
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
  if (embedded) recordSeedVersion(config.dataDir, SEED_VERSION);

  if (config.adminPhone) await ensureAdmin(database.db, config.adminPhone, new Date());
  if (config.demoLogin) {
    console.log(
      'Demo sign-in is on: codes are shown on the page and the demo accounts are open to anyone. Set DEMO_LOGIN=0 before real people sign in.',
    );
  }

  const app = createApp({ db: database.db, config });
  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    const store = database.kind === 'postgres' ? 'PostgreSQL' : 'embedded PostgreSQL';
    console.log(`Unun API is running at http://localhost:${info.port} (${store}).`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${config.port} is already in use. Stop the other program or set PORT in apps/api/.env.`,
      );
    } else {
      console.error(error);
    }
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => {
      void database.close().finally(() => process.exit(0));
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
