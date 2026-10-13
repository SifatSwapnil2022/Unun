/*
 * The API's Netlify function. `build:netlify` compiles this file, with the shared
 * package inlined, to netlify/functions/api.mjs, which Netlify then deploys. The site
 * sends /api/* here (see apps/web/netlify.toml), and the web app's server calls
 * /.netlify/functions/api directly.
 */
import { createNetlifyHandler } from './netlify';

export default createNetlifyHandler();
