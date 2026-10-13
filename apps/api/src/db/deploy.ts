/**
 * Prepares a PostgreSQL server for a deploy: applies migrations, then fills an empty
 * database with the demo data. Runs during the Netlify build; safe to run again.
 */
import { loadConfig, loadEnvFile } from '../config';
import { openPostgres } from './postgres';
import { prepareDatabase } from './prepare';

loadEnvFile();
const config = loadConfig();

if (!config.databaseUrl) {
  console.error(
    'No database to prepare. Create one under Data & Storage > Database in Netlify, or set DATABASE_URL.',
  );
  process.exit(1);
}

const database = await openPostgres(config.databaseUrl, { migrate: true });
try {
  await prepareDatabase(database.db, config, new Date());
  console.log('The database is up to date.');
} finally {
  await database.close();
}
