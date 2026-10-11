import {
  addressRequestSchema,
  codeRequestSchema,
  profileUpdateSchema,
  verifyRequestSchema,
  type SessionDto,
} from '@unun/core/contracts';
import { rateLimit } from '../http/rate-limit';
import { idParam, parse, readJson } from '../http/request';
import { addAddress, listAddresses, removeAddress } from '../modules/account/service';
import {
  listDemoAccounts,
  requestCode,
  toUserDto,
  updateName,
  verifyCode,
} from '../modules/auth/service';
import { listOrdersOf } from '../modules/orders/service';
import { recommendationsFor } from '../modules/ml/suggest';
import { NO_STORE, type RouteContext } from './context';

export function accountRoutes(context: RouteContext): void {
  const { app, db, config, ml, now, sessions, sendCode } = context;
  const signInLimit = rateLimit({ limit: config.signInsPerMinute, windowMs: 60_000 });

  /* Signing in and out */

  app.post('/v1/auth/code', signInLimit, async (c) => {
    const { phone } = parse(codeRequestSchema, await readJson(c.req.raw));
    return c.json(await requestCode(db, config, { phone, now: now(), send: sendCode }));
  });

  app.post('/v1/auth/verify', signInLimit, async (c) => {
    const request = parse(verifyRequestSchema, await readJson(c.req.raw));
    const session = await verifyCode(db, { ...request, now: now() });
    sessions.start(c, session);
    return c.json<SessionDto>({ user: toUserDto(session.user) });
  });

  app.post('/v1/auth/signout', async (c) => {
    await sessions.end(c);
    return c.json<SessionDto>({ user: null });
  });

  app.get('/v1/auth/demo-accounts', async (c) =>
    c.json(await listDemoAccounts(db, config)),
  );

  /* The signed-in person */

  app.get('/v1/me', async (c) => {
    c.header('Cache-Control', NO_STORE);
    const user = await sessions.current(c);
    // Not being signed in is an ordinary answer here, not an error.
    return c.json<SessionDto>({ user: user ? toUserDto(user) : null });
  });

  app.patch('/v1/me', async (c) => {
    const user = await sessions.require(c);
    const { name } = parse(profileUpdateSchema, await readJson(c.req.raw));
    return c.json<SessionDto>({ user: toUserDto(await updateName(db, user.id, name)) });
  });

  app.get('/v1/me/orders', async (c) => {
    c.header('Cache-Control', NO_STORE);
    const user = await sessions.require(c);
    return c.json(await listOrdersOf(db, user.id, now()));
  });

  app.get('/v1/me/recommendations', async (c) => {
    c.header('Cache-Control', NO_STORE);
    const user = await sessions.require(c);
    const picks = await recommendationsFor(
      db,
      { config, ml },
      { userId: user.id, areaId: c.req.query('area') || undefined, now: now() },
    );
    return c.json(picks);
  });

  app.get('/v1/me/addresses', async (c) => {
    c.header('Cache-Control', NO_STORE);
    const user = await sessions.require(c);
    return c.json(await listAddresses(db, user.id));
  });

  app.post('/v1/me/addresses', async (c) => {
    const user = await sessions.require(c);
    const request = parse(addressRequestSchema, await readJson(c.req.raw));
    return c.json(await addAddress(db, user.id, request, now()), 201);
  });

  app.delete('/v1/me/addresses/:id', async (c) => {
    const user = await sessions.require(c);
    return c.json(await removeAddress(db, user.id, idParam(c.req.param('id'))));
  });
}
