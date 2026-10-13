import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { openDatabase, type DatabaseHandle } from './db/client';
import { prepareDatabase } from './db/prepare';
import { apiPath, createNetlifyHandler, deployedEnv } from './netlify';

const SITE = 'https://unun.netlify.app';

describe('apiPath', () => {
  it('removes the prefix the request came under', () => {
    expect(apiPath('/.netlify/functions/api/v1/areas')).toBe('/v1/areas');
    expect(apiPath('/api/v1/kitchens/dum-ghor')).toBe('/v1/kitchens/dum-ghor');
    expect(apiPath('/api')).toBe('/');
  });

  it('leaves other paths alone, including ones that only start with the same letters', () => {
    expect(apiPath('/v1/areas')).toBe('/v1/areas');
    expect(apiPath('/apiary/v1')).toBe('/apiary/v1');
  });
});

describe('deployedEnv', () => {
  it('follows the site address and turns the Python service off', () => {
    const config = loadConfig(
      deployedEnv({ NETLIFY_DB_URL: 'postgres://db' }, `${SITE}/`),
    );
    expect(config.webOrigin).toBe(SITE);
    expect(config.publicApiUrl).toBe(`${SITE}/api`);
    expect(config.mlUrl).toBeNull();
    expect(config.secureCookies).toBe(true);
    expect(config.databaseUrl).toBe('postgres://db');
  });

  it('keeps what the site sets itself', () => {
    const config = loadConfig(
      deployedEnv(
        {
          WEB_ORIGIN: 'https://unun.example',
          ML_URL: 'https://ml.example',
          DATABASE_URL: 'postgres://mine',
          NETLIFY_DB_URL: 'postgres://netlify',
        },
        SITE,
      ),
    );
    expect(config.webOrigin).toBe('https://unun.example');
    expect(config.mlUrl).toBe('https://ml.example');
    expect(config.databaseUrl).toBe('postgres://mine');
  });
});

describe('the Netlify handler', () => {
  let database: DatabaseHandle;

  beforeAll(async () => {
    database = await openDatabase({ databaseUrl: null, dataDir: null });
    await prepareDatabase(database.db, loadConfig({ DEMO_LOGIN: '0' }), new Date());
  });

  afterAll(async () => {
    await database.close();
  });

  const handler = () =>
    createNetlifyHandler({
      env: { NETLIFY_DB_URL: 'postgres://stand-in' },
      open: async () => database,
    });

  it('answers on both of its paths', async () => {
    const handle = handler();
    const direct = await handle(new Request(`${SITE}/.netlify/functions/api/v1/areas`));
    const viaSite = await handle(new Request(`${SITE}/api/v1/areas`));
    expect(direct.status).toBe(200);
    expect(viaSite.status).toBe(200);
    expect(await viaSite.json()).toEqual(await direct.json());
  });

  it('passes a request body through', async () => {
    const handle = handler();
    const response = await handle(
      new Request(`${SITE}/api/v1/auth/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: 'not a number' }),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('invalid_phone');
  });

  it('only lets the site itself call it from a browser', async () => {
    const handle = handler();
    const response = await handle(
      new Request(`${SITE}/api/v1/areas`, { headers: { Origin: SITE } }),
    );
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE);
  });

  it('says plainly when no database is connected', async () => {
    let opened = 0;
    const handle = createNetlifyHandler({
      env: {},
      open: async () => {
        opened += 1;
        return database;
      },
    });
    const first = await handle(new Request(`${SITE}/api/v1/areas`));
    expect(first.status).toBe(503);
    const body = (await first.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/No database is connected/);
    expect(opened).toBe(0);
  });

  it('recovers when the database could not be reached at first', async () => {
    let attempts = 0;
    const handle = createNetlifyHandler({
      env: { NETLIFY_DB_URL: 'postgres://stand-in' },
      open: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('connection refused');
        return database;
      },
    });
    const quiet = console.error;
    console.error = () => {};
    try {
      expect((await handle(new Request(`${SITE}/api/v1/areas`))).status).toBe(503);
    } finally {
      console.error = quiet;
    }
    expect((await handle(new Request(`${SITE}/api/v1/areas`))).status).toBe(200);
    expect(attempts).toBe(2);
  });
});
