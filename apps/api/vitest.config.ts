import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Each test file starts its own in-memory PostgreSQL, which takes a moment.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
