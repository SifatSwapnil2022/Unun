import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discardStaleData, recordSeedVersion, removeData } from './embedded';

let folder: string;
let dataDir: string;

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'unun-embedded-'));
  dataDir = path.join(folder, 'pglite');
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

const createData = () => {
  mkdirSync(dataDir);
  writeFileSync(path.join(dataDir, 'PG_VERSION'), '17\n');
};

describe('discardStaleData', () => {
  it('does nothing when there is no database yet', () => {
    expect(discardStaleData(dataDir, 2)).toBe(false);
  });

  it('keeps a database that the current seed filled', () => {
    createData();
    recordSeedVersion(dataDir, 2);

    expect(discardStaleData(dataDir, 2)).toBe(false);
    expect(existsSync(dataDir)).toBe(true);
  });

  it('deletes a database that an older seed filled', () => {
    createData();
    recordSeedVersion(dataDir, 1);

    expect(discardStaleData(dataDir, 2)).toBe(true);
    expect(existsSync(dataDir)).toBe(false);
  });

  it('deletes a database from before versions were recorded', () => {
    createData();

    expect(discardStaleData(dataDir, 2)).toBe(true);
    expect(existsSync(dataDir)).toBe(false);
  });
});

describe('removeData', () => {
  it('removes the database and its marker', () => {
    createData();
    recordSeedVersion(dataDir, 2);

    removeData(dataDir);
    expect(existsSync(dataDir)).toBe(false);
    expect(existsSync(`${dataDir}.seed`)).toBe(false);
  });
});
