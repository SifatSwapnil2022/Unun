import { fileURLToPath } from 'node:url';

/*
 * This file sits one level below the package root, both as source (src/paths.ts) and
 * when bundled (dist/server.js), so the same relative paths work in both.
 */
const fromPackageRoot = (relative: string) =>
  fileURLToPath(new URL(`../${relative}`, import.meta.url));

export const MIGRATIONS_DIR = fromPackageRoot('drizzle');
export const DEFAULT_DATA_DIR = fromPackageRoot('.data/pglite');
export const ENV_FILE = fromPackageRoot('.env');
