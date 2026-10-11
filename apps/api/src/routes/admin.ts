import { USER_ROLES, type UserRole } from '@unun/core';
import {
  adminKitchenUpdateSchema,
  adminUserUpdateSchema,
  cancelRequestSchema,
  issueResolveSchema,
  reviewModerationSchema,
} from '@unun/core/contracts';
import { idParam, oneOf, parse, readJson } from '../http/request';
import {
  ORDER_SCOPES,
  changeRole,
  getOverview,
  listKitchens,
  listOrders,
  listUsers,
  updateKitchen,
  type OrderScope,
} from '../modules/admin/service';
import {
  ISSUE_SCOPES,
  listIssues,
  listReviews,
  moderateReview,
  resolveIssue,
  type IssueScope,
} from '../modules/feedback/service';
import { systemStatus } from '../modules/ml/suggest';
import { cancelOrder } from '../modules/orders/progress';
import { lapseUnpaidOrders } from '../modules/payments/service';
import { NO_STORE, type RouteContext } from './context';

/** The admin workspace. Every route needs the admin role. */
export function adminRoutes(context: RouteContext): void {
  const { app, db, ml, now, sessions, payments } = context;

  app.get('/v1/admin/system', async (c) => {
    c.header('Cache-Control', NO_STORE);
    await sessions.requireRole(c, 'admin');
    return c.json(await systemStatus(ml));
  });

  app.get('/v1/admin/overview', async (c) => {
    c.header('Cache-Control', NO_STORE);
    await sessions.requireRole(c, 'admin');
    await lapseUnpaidOrders(db, now());
    return c.json(await getOverview(db, now()));
  });

  app.get('/v1/admin/orders', async (c) => {
    c.header('Cache-Control', NO_STORE);
    await sessions.requireRole(c, 'admin');
    await lapseUnpaidOrders(db, now());
    const orders = await listOrders(db, {
      scope: oneOf<OrderScope>(ORDER_SCOPES, c.req.query('scope')) ?? 'all',
      query: c.req.query('q')?.slice(0, 60) || undefined,
      now: now(),
    });
    return c.json(orders);
  });

  app.post('/v1/admin/orders/:publicId/cancel', async (c) => {
    const admin = await sessions.requireRole(c, 'admin');
    const { reason } = parse(cancelRequestSchema, await readJson(c.req.raw));
    await cancelOrder(db, payments, {
      publicId: c.req.param('publicId'),
      reason,
      actor: { kind: 'admin' },
      byUserId: admin.id,
      now: now(),
    });
    return c.json({ ok: true });
  });

  app.get('/v1/admin/issues', async (c) => {
    c.header('Cache-Control', NO_STORE);
    await sessions.requireRole(c, 'admin');
    const reports = await listIssues(db, {
      scope: oneOf<IssueScope>(ISSUE_SCOPES, c.req.query('scope')) ?? 'open',
      now: now(),
    });
    return c.json(reports);
  });

  app.post('/v1/admin/issues/:id/resolve', async (c) => {
    const admin = await sessions.requireRole(c, 'admin');
    const { refund, note } = parse(issueResolveSchema, await readJson(c.req.raw));
    await resolveIssue(db, payments, {
      id: idParam(c.req.param('id')),
      refund,
      note,
      byUserId: admin.id,
      now: now(),
    });
    return c.json({ ok: true });
  });

  app.get('/v1/admin/reviews', async (c) => {
    c.header('Cache-Control', NO_STORE);
    await sessions.requireRole(c, 'admin');
    return c.json(
      await listReviews(db, { hiddenOnly: c.req.query('scope') === 'hidden' }),
    );
  });

  app.patch('/v1/admin/reviews/:id', async (c) => {
    await sessions.requireRole(c, 'admin');
    const { hidden } = parse(reviewModerationSchema, await readJson(c.req.raw));
    await moderateReview(db, { id: idParam(c.req.param('id')), hidden });
    return c.json({ ok: true });
  });

  app.get('/v1/admin/kitchens', async (c) => {
    c.header('Cache-Control', NO_STORE);
    await sessions.requireRole(c, 'admin');
    return c.json(await listKitchens(db, now()));
  });

  app.patch('/v1/admin/kitchens/:slug', async (c) => {
    await sessions.requireRole(c, 'admin');
    const update = parse(adminKitchenUpdateSchema, await readJson(c.req.raw));
    return c.json(
      await updateKitchen(db, { slug: c.req.param('slug'), update, now: now() }),
    );
  });

  app.get('/v1/admin/users', async (c) => {
    c.header('Cache-Control', NO_STORE);
    await sessions.requireRole(c, 'admin');
    const people = await listUsers(db, {
      role: oneOf<UserRole>(USER_ROLES, c.req.query('role')),
      query: c.req.query('q')?.slice(0, 60) || undefined,
    });
    return c.json(people);
  });

  app.patch('/v1/admin/users/:id', async (c) => {
    const admin = await sessions.requireRole(c, 'admin');
    const { role } = parse(adminUserUpdateSchema, await readJson(c.req.raw));
    const person = await changeRole(db, {
      adminId: admin.id,
      userId: idParam(c.req.param('id')),
      role,
    });
    return c.json(person);
  });
}
