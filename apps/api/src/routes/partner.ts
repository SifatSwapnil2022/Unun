import {
  cancelRequestSchema,
  itemUpdateSchema,
  kitchenAdvanceSchema,
  kitchenSettingsSchema,
} from '@unun/core/contracts';
import { idParam, parse, readJson } from '../http/request';
import { advanceOrder, cancelOrder } from '../modules/orders/progress';
import {
  getBoard,
  getMenu,
  listOwnedKitchens,
  updateItem,
  updateSettings,
} from '../modules/partner/service';
import { NO_STORE, type RouteContext } from './context';

/** The restaurant owner's workspace. Every route needs the owner role. */
export function partnerRoutes(context: RouteContext): void {
  const { app, db, config, now, sessions, payments } = context;

  app.get('/v1/partner/kitchens', async (c) => {
    c.header('Cache-Control', NO_STORE);
    const owner = await sessions.requireRole(c, 'owner');
    return c.json(await listOwnedKitchens(db, config, owner.id, now()));
  });

  app.get('/v1/partner/board', async (c) => {
    c.header('Cache-Control', NO_STORE);
    const owner = await sessions.requireRole(c, 'owner');
    const board = await getBoard(db, config, {
      ownerId: owner.id,
      slug: c.req.query('kitchen') || undefined,
      now: now(),
    });
    return c.json(board);
  });

  app.patch('/v1/partner/kitchens/:slug', async (c) => {
    const owner = await sessions.requireRole(c, 'owner');
    const settings = parse(kitchenSettingsSchema, await readJson(c.req.raw));
    const kitchen = await updateSettings(db, config, {
      ownerId: owner.id,
      slug: c.req.param('slug'),
      settings,
      now: now(),
    });
    return c.json(kitchen);
  });

  app.get('/v1/partner/menu', async (c) => {
    c.header('Cache-Control', NO_STORE);
    const owner = await sessions.requireRole(c, 'owner');
    const menu = await getMenu(db, {
      ownerId: owner.id,
      slug: c.req.query('kitchen') || undefined,
    });
    return c.json(menu);
  });

  app.patch('/v1/partner/items/:id', async (c) => {
    const owner = await sessions.requireRole(c, 'owner');
    const update = parse(itemUpdateSchema, await readJson(c.req.raw));
    const menu = await updateItem(db, {
      ownerId: owner.id,
      itemId: idParam(c.req.param('id')),
      update,
    });
    return c.json(menu);
  });

  app.post('/v1/partner/orders/:publicId/advance', async (c) => {
    const owner = await sessions.requireRole(c, 'owner');
    const { to } = parse(kitchenAdvanceSchema, await readJson(c.req.raw));
    await advanceOrder(db, {
      publicId: c.req.param('publicId'),
      to,
      actor: { kind: 'kitchen', ownerId: owner.id },
      now: now(),
    });
    return c.json({ ok: true });
  });

  app.post('/v1/partner/orders/:publicId/decline', async (c) => {
    const owner = await sessions.requireRole(c, 'owner');
    const { reason } = parse(cancelRequestSchema, await readJson(c.req.raw));
    await cancelOrder(db, payments, {
      publicId: c.req.param('publicId'),
      reason,
      actor: { kind: 'kitchen', ownerId: owner.id },
      byUserId: null,
      now: now(),
    });
    return c.json({ ok: true });
  });
}
