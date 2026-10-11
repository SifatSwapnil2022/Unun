import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // The shared package ships TypeScript source, so it is compiled into the bundle.
  noExternal: ['@unun/core'],
});
