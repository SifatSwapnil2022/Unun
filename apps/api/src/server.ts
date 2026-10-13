import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig, loadEnvFile } from './config';
import { openDatabase } from './db/client';
import { discardStaleData, recordSeedVersion } from './db/embedded';
import { prepareDatabase } from './db/prepare';
import { SEED_VERSION } from './seed';

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

  await prepareDatabase(database.db, config, new Date());
  if (embedded) recordSeedVersion(config.dataDir, SEED_VERSION);

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
