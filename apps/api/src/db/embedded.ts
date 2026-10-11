/**
 * The embedded database holds demo data that is written once, when it is empty. When
 * the demo data in the code changes, an existing database would keep serving the old
 * kitchens and menus. So a small file beside the database records which version of the
 * seed filled it, and a database filled by another version is thrown away on start.
 *
 * This only ever applies to the embedded database. A real PostgreSQL server is never
 * touched: its data is changed by migrations alone.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const markerOf = (dataDir: string) => `${dataDir}.seed`;

/** Deletes the embedded database if an older seed filled it. Returns true if it did. */
export function discardStaleData(dataDir: string, seedVersion: number): boolean {
  if (!existsSync(dataDir)) return false;

  const marker = markerOf(dataDir);
  const filledBy = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : null;
  if (filledBy === String(seedVersion)) return false;

  rmSync(dataDir, { recursive: true, force: true });
  return true;
}

/** Records which seed version the embedded database now holds. */
export function recordSeedVersion(dataDir: string, seedVersion: number): void {
  writeFileSync(markerOf(dataDir), `${seedVersion}\n`);
}

/** Removes the embedded database and its marker. */
export function removeData(dataDir: string): void {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(markerOf(dataDir), { force: true });
}
