import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_DIR } from '../paths';
import { openPostgres } from './postgres';
import * as schema from './schema';

/*
 * The two drivers expose the same query builder. The embedded driver's type is used as
 * the common one; only raw `execute` results differ, and this codebase does not use them.
 */
export type Database = PgliteDatabase<typeof schema>;

/** The handle passed to code that may run inside a transaction. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type DatabaseHandle = {
  db: Database;
  kind: 'postgres' | 'embedded';
  close: () => Promise<void>;
};

type OpenOptions = {
  /** A PostgreSQL connection string. Null uses the embedded database. */
  databaseUrl: string | null;
  /** Directory for the embedded database. Null keeps it in memory, for tests. */
  dataDir: string | null;
};

/** Opens the database and applies any migrations that have not run yet. */
export async function openDatabase(options: OpenOptions): Promise<DatabaseHandle> {
  if (options.databaseUrl) return openPostgres(options.databaseUrl, { migrate: true });

  if (options.dataDir) mkdirSync(options.dataDir, { recursive: true });
  const client = options.dataDir ? new PGlite(options.dataDir) : new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db, kind: 'embedded', close: () => client.close() };
}
