import { createApp } from './app';
import { loadConfig } from './config';
import type { DatabaseHandle } from './db/client';
import { openPostgres } from './db/postgres';
import { ApiError } from './http/errors';

/*
 * The API as a Netlify function. Netlify calls the exported handler with a standard
 * Request; the Hono app answers it. The database is opened on the first request and
 * kept while the function instance stays warm. Migrations and demo data are applied
 * by `db:deploy` during the build, not here, so a cold start only connects.
 */

/** What this code reads from the context Netlify passes to a function. */
export type NetlifyContext = { site?: { url?: string } };

type Handler = (request: Request) => Promise<Response>;

/** The paths the function is reached on: its own address, and /api/* on the site. */
const PREFIXES = ['/.netlify/functions/api', '/api'];

/** The API's own path for a request that arrived under one of the prefixes. */
export function apiPath(pathname: string): string {
  for (const prefix of PREFIXES) {
    if (pathname === prefix) return '/';
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return pathname;
}

/**
 * The settings for a deployed site. Anything set in Netlify's environment wins; the
 * rest follows from the site's address. The Python service does not run on Netlify,
 * so it is off unless ML_URL points at one hosted elsewhere.
 */
export function deployedEnv(env: NodeJS.ProcessEnv, siteUrl: string): NodeJS.ProcessEnv {
  const site = siteUrl.replace(/\/$/, '');
  return {
    ...env,
    NODE_ENV: 'production',
    WEB_ORIGIN: env.WEB_ORIGIN?.trim() || site,
    API_PUBLIC_URL: env.API_PUBLIC_URL?.trim() || `${site}/api`,
    ML_URL: env.ML_URL?.trim() || 'off',
  };
}

type HandlerOptions = {
  env?: NodeJS.ProcessEnv;
  /** How the database is opened. Tests pass an in-memory one. */
  open?: (databaseUrl: string) => Promise<DatabaseHandle>;
};

class MissingDatabase extends Error {
  constructor() {
    super('No DATABASE_URL or NETLIFY_DB_URL is set.');
    this.name = 'MissingDatabase';
  }
}

function unavailable(message: string): Response {
  const body = new ApiError('internal_error', message).toBody();
  return Response.json(body, { status: 503 });
}

export function createNetlifyHandler(options: HandlerOptions = {}) {
  const env = options.env ?? process.env;
  const open =
    options.open ??
    ((databaseUrl: string) =>
      openPostgres(databaseUrl, { migrate: false, maxConnections: 3 }));

  let ready: Promise<Handler> | null = null;

  async function start(siteUrl: string): Promise<Handler> {
    const config = loadConfig(deployedEnv(env, siteUrl));
    if (!config.databaseUrl) throw new MissingDatabase();
    const database = await open(config.databaseUrl);
    const app = createApp({ db: database.db, config });
    return async (request) => app.fetch(request);
  }

  return async (request: Request, context: NetlifyContext = {}): Promise<Response> => {
    const url = new URL(request.url);
    const siteUrl = env.URL?.trim() || context.site?.url || url.origin;

    ready ??= start(siteUrl).catch((error: unknown) => {
      // The next request tries again rather than failing for the life of the instance.
      ready = null;
      throw error;
    });

    let handle: Handler;
    try {
      handle = await ready;
    } catch (error) {
      if (error instanceof MissingDatabase) {
        return unavailable(
          'No database is connected. Create one under Data & Storage > Database in Netlify, or set DATABASE_URL, then deploy again.',
        );
      }
      console.error(error);
      return unavailable('The service could not reach its database. Try again shortly.');
    }

    url.pathname = apiPath(url.pathname);
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const forwarded = new Request(url, {
      method: request.method,
      headers: request.headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
    });
    return handle(forwarded);
  };
}
