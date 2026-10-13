import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { MIGRATIONS_DIR } from '../paths';
import type { Database, DatabaseHandle } from './client';
import * as schema from './schema';

type PostgresOptions = {
  /** Apply migrations that have not run yet. Off where a deploy step has done it. */
  migrate: boolean;
  /** Connections kept open. A serverless function needs very few. */
  maxConnections?: number;
};

/**
 * Opens a PostgreSQL server. Kept apart from the embedded driver so that code which
 * only ever talks to a server, such as the Netlify function, does not bundle PGlite.
 */
export async function openPostgres(
  databaseUrl: string,
  options: PostgresOptions,
): Promise<DatabaseHandle> {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: options.maxConnections ?? 10,
  });
  const db = drizzle(pool, { schema });
  if (options.migrate) await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return {
    db: db as unknown as Database,
    kind: 'postgres',
    close: () => pool.end(),
  };
}
