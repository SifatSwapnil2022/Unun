import { defineConfig } from 'tsup';

/*
 * Compiles the Netlify function. Netlify's own bundler leaves workspace packages
 * unbundled, and @unun/core ships TypeScript source that Node cannot load, so it is
 * compiled in here. The other dependencies stay as imports for Netlify to bundle.
 */
export default defineConfig({
  entry: { api: 'src/netlify-entry.ts' },
  outDir: 'netlify/functions',
  format: ['esm'],
  outExtension: () => ({ js: '.mjs' }),
  target: 'node22',
  clean: true,
  noExternal: ['@unun/core'],
});
