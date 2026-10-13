/*
 * The API's Netlify function. `build:netlify` compiles this file, with the shared
 * package inlined, to netlify/functions/api.mjs, which Netlify then deploys. The site
 * sends /api/* here (see apps/web/netlify.toml), and the web app's server calls
 * /.netlify/functions/api directly.
 */
import { fileURLToPath } from 'node:url';
import { createNetlifyHandler } from './netlify';

export default createNetlifyHandler({
  // netlify.toml ships apps/api/drizzle with the function, at the same place relative
  // to the compiled file (apps/api/netlify/functions/api.mjs) as in the repository.
  migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
});
