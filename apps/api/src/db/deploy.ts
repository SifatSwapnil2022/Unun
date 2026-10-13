/**
 * Prepares a PostgreSQL server ahead of time: applies migrations, then fills an empty
 * database with the demo data. Safe to run again. On Netlify the function does this
 * itself on its first request, so this is for other hosts or for loading data early.
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

const database = await openPostgres(config.databaseUrl, {
  migrate: true,
  prepare: (db) => prepareDatabase(db, config, new Date()),
});
await database.close();
console.log('The database is up to date.');
