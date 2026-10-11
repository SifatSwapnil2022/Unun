import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests. They run against the real site and the real API, started here on
 * their own ports and their own empty database, so a test run never touches the data
 * of a `pnpm dev` that is open in another window.
 *
 *   pnpm e2e:install   once, to download the browser
 *   pnpm e2e
 */
const root = fileURLToPath(new URL('..', import.meta.url));
const dataDir = path.join(root, 'e2e', '.data', `run-${Date.now()}`);

const API_PORT = 4100;
const WEB_PORT = 3100;
const api = `http://127.0.0.1:${API_PORT}`;
const web = `http://localhost:${WEB_PORT}`;

/** A browser that is already installed can be used instead of Playwright's own. */
const executablePath = process.env.E2E_CHROMIUM || undefined;

export default defineConfig({
  testDir: './tests',
  // The tests share one database and one clock, so they take turns.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: './test-results',

  use: {
    baseURL: web,
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@phone/ },
    {
      name: 'phone',
      // Chromium at an iPhone's size. Safari's own engine is not exercised here.
      use: { ...devices['Pixel 7'] },
      grep: /@phone/,
    },
  ],

  webServer: [
    {
      command: 'node node_modules/tsx/dist/cli.mjs src/server.ts',
      cwd: path.join(root, 'apps', 'api'),
      url: `${api}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        PORT: String(API_PORT),
        WEB_ORIGIN: web,
        DATA_DIR: dataDir,
        DEMO_LOGIN: '1',
        DEMO_ALWAYS_OPEN: '1',
        // Fast enough that an order is delivered while a test watches it.
        DEMO_SPEED: '60',
        // The tests must pass with or without the Python service, so they run without.
        ML_URL: 'off',
      },
    },
    {
      command: `node node_modules/next/dist/bin/next dev --port ${WEB_PORT}`,
      cwd: path.join(root, 'apps', 'web'),
      url: `${web}/en/sign-in`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { API_URL: api },
    },
  ],
});
