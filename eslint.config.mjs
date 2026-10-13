import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/*
 * Lint rules for the packages that are not Next.js apps. The web app has its own
 * config in apps/web, which ESLint finds first when it runs there.
 */
export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/drizzle/**',
    '**/.venv/**',
    '**/test-results/**',
    '**/.netlify/**',
    // Compiled during the Netlify build.
    'apps/api/netlify/**',
    'apps/web/**',
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        AbortSignal: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
      },
    },
  },
]);
