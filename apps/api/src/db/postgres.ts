import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { MIGRATIONS_DIR } from '../paths';
import type { Database, DatabaseHandle } from './client';
import * as schema from './schema';

/** Any fixed number shared by every process that sets up the same database. */
const SETUP_LOCK = 7_316_486;

type PostgresOptions = {
  /** Apply migrations that have not run yet. */
  migrate: boolean;
  /** Where the migration files are. Defaults to the package's drizzle folder. */
  migrationsFolder?: string;
  /** Connections kept open. A serverless function needs very few. */
  maxConnections?: number;
  /** Runs after the migrations, under the same lock: loading demo data, say. */
  prepare?: (db: Database) => Promise<void>;
};

/**
 * Opens a PostgreSQL server. Kept apart from the embedded driver so that code which
 * only ever talks to a server, such as the Netlify function, does not bundle PGlite.
 *
 * Setting up (migrations, then `prepare`) holds a Postgres advisory lock, so when
 * several function instances start at once, one does the work and the others wait
 * for it and then find nothing left to do.
 */
export async function openPostgres(
  databaseUrl: string,
  options: PostgresOptions,
): Promise<DatabaseHandle> {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    // One connection holds the lock while the others do the work.
    max: Math.max(2, options.maxConnections ?? 10),
  });
  const db = drizzle(pool, { schema });

  if (options.migrate || options.prepare) {
    try {
      await setUp(pool, async () => {
        if (options.migrate) {
          await migrate(db, {
            migrationsFolder: options.migrationsFolder ?? MIGRATIONS_DIR,
          });
        }
        if (options.prepare) await options.prepare(db as unknown as Database);
      });
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  return {
    db: db as unknown as Database,
    kind: 'postgres',
    close: () => pool.end(),
  };
}

async function setUp(pool: pg.Pool, work: () => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SETUP_LOCK]);
    try {
      await work();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SETUP_LOCK]);
    }
  } finally {
    client.release();
  }
}
