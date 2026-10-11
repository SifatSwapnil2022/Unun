/**
 * After the food arrives: rating the kitchen, reporting a problem, the refund support
 * staff can give for one, and the allergen list on every dish.
 */
import {
  ALLERGENS,
  ISSUE_WINDOW_HOURS,
  MAX_ISSUES_PER_ORDER,
  RATING_WINDOW_DAYS,
} from '@unun/core';
import type {
  AdminIssues,
  AdminOverview,
  AdminReviews,
  ApiErrorBody,
  KitchenDetail,
  KitchenList,
  OrderDto,
  PartnerBoard,
  PartnerMenu,
  PaymentDto,
} from '@unun/core/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issues, refunds } from '../../db/schema';
import { startHarness, type Harness, type SignedIn } from '../../test/harness';
import { ADMIN, CUSTOMER, OTHER_OWNER, OWNER } from '../../test/people';
import { placeOrder } from '../../test/shop';

let api: Harness;
let admin: SignedIn;
let owner: SignedIn;

/** Nobody runs these kitchens, so the simulator delivers their orders. */
const ALOO = { kitchen: 'aloo-bukhara', area: 'dhanmondi' };
const BORO = { kitchen: 'boro-deg', area: 'mirpur' };

const HOUR = 60 * 60_000;

type Refusal = OrderDto & ApiErrorBody;

const orderOf = async (token: string) =>
  (await api.get<OrderDto>(`/v1/orders/${token}`)).body;

const rate = (token: string, body: unknown) =>
  api.post<Refusal>(`/v1/orders/${token}/rating`, body);

const report = (token: string, body: unknown) =>
  api.post<Refusal>(`/v1/orders/${token}/issues`, body);

const resolve = (id: number, body: unknown, as: SignedIn = admin) =>
  as.post<{ ok: true } & ApiErrorBody>(`/v1/admin/issues/${id}/resolve`, body);

const COLD = { kind: 'quality', detail: 'The rice was cold and the gravy had split.' };

/** Places an order and lets the simulator deliver it. */
async function deliveredOrder(
  where = ALOO,
  options: Parameters<typeof placeOrder>[1] | object = {},
) {
  const order = await placeOrder(api, { ...where, ...options });
  if (order.payment) {
    await api.post<PaymentDto>(`/v1/payments/${order.payment.token}/sandbox`, {
      outcome: 'approve',
    });
  }
  api.advance(HOUR);
  expect((await orderOf(order.token)).status).toBe('delivered');
  return order;
}

beforeAll(async () => {
  api = await startHarness();
  [admin, owner] = await Promise.all([api.signIn(ADMIN), api.signIn(OWNER)]);
});

afterAll(async () => {
  await api.close();
});

describe('rating an order', () => {
  it('is not open until the food has arrived', async () => {
    const order = await placeOrder(api, ALOO);
    expect((await orderOf(order.token)).canRate).toBe(false);

    const early = await rate(order.token, { stars: 5 });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('invalid_transition');
  });

  it('stores one rating for a delivered order', async () => {
    const order = await deliveredOrder();
    expect((await orderOf(order.token)).canRate).toBe(true);

    const rated = await rate(order.token, {
      stars: 4,
      comment: '  Hot and on time. A little oily.  ',
    });
    expect(rated.status).toBe(201);
    expect(rated.body.rating).toMatchObject({
      stars: 4,
      comment: 'Hot and on time. A little oily.',
    });
    expect(rated.body.canRate).toBe(false);

    const again = await rate(order.token, { stars: 1 });
    expect(again.status).toBe(409);
    expect((await orderOf(order.token)).rating?.stars).toBe(4);
  });

  it('refuses stars outside one to five, and half stars', async () => {
    const order = await deliveredOrder();
    for (const stars of [0, 6, 4.5, '5']) {
      expect((await rate(order.token, { stars })).status, String(stars)).toBe(400);
    }
    expect((await rate(order.token, { stars: 5, comment: 'x'.repeat(301) })).status).toBe(
      400,
    );
  });

  it('closes two weeks after delivery', async () => {
    const order = await deliveredOrder();
    api.advance((RATING_WINDOW_DAYS * 24 + 1) * HOUR);

    expect((await orderOf(order.token)).canRate).toBe(false);
    expect((await rate(order.token, { stars: 5 })).status).toBe(409);
  });

  it('refuses a cancelled order', async () => {
    const order = await placeOrder(api, ALOO);
    await admin.post(`/v1/admin/orders/${order.publicId}/cancel`, {
      reason: 'Customer asked',
    });
    expect((await rate(order.token, { stars: 5 })).status).toBe(409);
  });

  it('answers 404 for a link that opens no order', async () => {
    expect((await rate('no-such-token', { stars: 5 })).status).toBe(404);
  });
});

describe('a kitchen and its ratings', () => {
  it('shows the average, the spread and the latest comments', async () => {
    const before = (await api.get<KitchenDetail>('/v1/kitchens/boro-deg')).body;
    expect(before.rating).toEqual({ average: null, count: 0 });
    expect(before.reviews).toEqual({ byStars: [0, 0, 0, 0, 0], latest: [] });

    const [first, second, third] = [
      await deliveredOrder(BORO, {
        customer: { name: 'Mitu Rahman', phone: '01712000001' },
      }),
      await deliveredOrder(BORO),
      await deliveredOrder(BORO),
    ];
    await rate(first.token, { stars: 5, comment: 'The best kacchi in Mirpur.' });
    await rate(second.token, { stars: 4 });
    await rate(third.token, { stars: 5 });

    const after = (await api.get<KitchenDetail>('/v1/kitchens/boro-deg')).body;
    expect(after.rating).toEqual({ average: 4.7, count: 3 });
    expect(after.reviews.byStars).toEqual([0, 0, 0, 1, 2]);

    // Only a rating with words is shown as a review.
    expect(after.reviews.latest).toHaveLength(1);
    const [review] = after.reviews.latest;
    expect(review).toMatchObject({
      stars: 5,
      comment: 'The best kacchi in Mirpur.',
      author: 'Mitu R.',
    });
    expect(review!.dishes.length).toBeGreaterThan(0);
  });

  it('carries the rating into the list, and can sort by it', async () => {
    const list = (await api.get<KitchenList>('/v1/kitchens?sort=rating')).body;
    const rated = list.kitchens.filter((kitchen) => kitchen.rating.count > 0);
    expect(rated.length).toBeGreaterThanOrEqual(2);

    // Every rated kitchen comes before every unrated one, best first.
    const averages = list.kitchens.map((kitchen) => kitchen.rating.average ?? 0);
    expect(averages).toEqual([...averages].sort((a, b) => b - a));
    expect(list.kitchens[0]!.slug).toBe('boro-deg');
  });

  it('never shows a full name or a phone number', async () => {
    const page = await api.get<KitchenDetail>('/v1/kitchens/boro-deg');
    const text = JSON.stringify(page.body.reviews);
    expect(text).not.toContain('Rahman');
    expect(text).not.toContain('01712000001');
  });

  it('shows an owner their own ratings, with or without words', async () => {
    const order = await deliveredOrder({ kitchen: 'dum-ghor', area: 'old-dhaka' });
    await rate(order.token, { stars: 3 });

    const board = (await owner.get<PartnerBoard>('/v1/partner/board')).body;
    expect(board.rating).toEqual({ average: 3, count: 1 });
    expect(board.reviews).toHaveLength(1);
    expect(board.reviews[0]).toMatchObject({ stars: 3, comment: null });
  });
});

describe('moderating ratings', () => {
  it('lets support staff hide a rating, which then stops counting', async () => {
    const order = await deliveredOrder({ kitchen: 'jafrani-haat', area: 'gulshan' });
    await rate(order.token, { stars: 1, comment: 'Abuse that should not be shown.' });

    const list = (await admin.get<AdminReviews>('/v1/admin/reviews')).body;
    const review = list.reviews.find((row) => row.order.publicId === order.publicId)!;
    expect(review).toMatchObject({ hidden: false, kitchen: { slug: 'jafrani-haat' } });

    expect(
      (await admin.patch(`/v1/admin/reviews/${review.id}`, { hidden: true })).status,
    ).toBe(200);
    const hidden = (await api.get<KitchenDetail>('/v1/kitchens/jafrani-haat')).body;
    expect(hidden.rating.count).toBe(0);
    expect(hidden.reviews.latest).toEqual([]);

    const onlyHidden = (await admin.get<AdminReviews>('/v1/admin/reviews?scope=hidden'))
      .body;
    expect(onlyHidden.reviews.map((row) => row.id)).toEqual([review.id]);

    await admin.patch(`/v1/admin/reviews/${review.id}`, { hidden: false });
    const shown = (await api.get<KitchenDetail>('/v1/kitchens/jafrani-haat')).body;
    expect(shown.rating).toEqual({ average: 1, count: 1 });

    // The customer still sees their own rating either way.
    expect((await orderOf(order.token)).rating?.stars).toBe(1);
  });

  it('is for admins only', async () => {
    expect((await api.get('/v1/admin/reviews')).status).toBe(401);
    expect((await owner.get('/v1/admin/reviews')).status).toBe(403);
    expect((await owner.patch('/v1/admin/reviews/1', { hidden: true })).status).toBe(403);
    expect((await admin.patch('/v1/admin/reviews/999999', { hidden: true })).status).toBe(
      404,
    );
  });
});

describe('reporting a problem', () => {
  it('is not open until the food has arrived', async () => {
    const order = await placeOrder(api, ALOO);
    expect((await orderOf(order.token)).canReport).toBe(false);
    expect((await report(order.token, COLD)).status).toBe(409);
  });

  it('stores a report, and takes one at a time', async () => {
    const order = await deliveredOrder();
    expect((await orderOf(order.token)).canReport).toBe(true);

    const sent = await report(order.token, COLD);
    expect(sent.status).toBe(201);
    expect(sent.body.issues).toHaveLength(1);
    expect(sent.body.issues[0]).toMatchObject({
      kind: 'quality',
      detail: COLD.detail,
      status: 'open',
      note: null,
      refund: 0,
    });
    expect(sent.body.canReport).toBe(false);

    const second = await report(order.token, { ...COLD, kind: 'late' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('already_taken');
  });

  it('needs a kind it knows and enough words to act on', async () => {
    const order = await deliveredOrder();
    expect((await report(order.token, { kind: 'quality', detail: 'bad' })).status).toBe(
      400,
    );
    expect(
      (await report(order.token, { kind: 'haunted', detail: COLD.detail })).status,
    ).toBe(400);
    expect((await orderOf(order.token)).issues).toEqual([]);
  });

  it('closes two days after delivery', async () => {
    const order = await deliveredOrder();
    api.advance((ISSUE_WINDOW_HOURS + 1) * HOUR);
    expect((await orderOf(order.token)).canReport).toBe(false);
    expect((await report(order.token, COLD)).status).toBe(409);
  });
});

describe('answering a report', () => {
  it('is for admins only', async () => {
    expect((await api.get('/v1/admin/issues')).status).toBe(401);
    expect((await owner.get('/v1/admin/issues')).status).toBe(403);
    expect((await resolve(1, { refund: 0, note: 'No.' }, owner)).status).toBe(403);
  });

  it('shows support staff what they need to decide', async () => {
    const order = await deliveredOrder(ALOO, {
      customer: { name: 'Tania Akter', phone: '01712000002' },
    });
    await report(order.token, COLD);

    const list = (await admin.get<AdminIssues>('/v1/admin/issues')).body;
    const issue = list.issues.find((row) => row.order.publicId === order.publicId)!;
    expect(list.open).toBe(list.issues.length);
    expect(issue).toMatchObject({
      kind: 'quality',
      status: 'open',
      order: {
        token: order.token,
        total: order.total,
        // A delivered cash order was paid in full, so all of it can go back.
        refundable: order.total,
        payment: { method: 'cash', state: 'paid', refunded: 0 },
        customer: { name: 'Tania Akter', phone: '01712000002' },
      },
    });
    expect(issue.order.arrival).not.toBeNull();
    expect(issue.order.lines.length).toBeGreaterThan(0);

    const overview = (await admin.get<AdminOverview>('/v1/admin/overview')).body;
    expect(overview.openIssues).toBe(list.open);
  });

  it('gives part of the money back and tells the customer why', async () => {
    const order = await deliveredOrder();
    const {
      issues: [sent],
    } = (await report(order.token, COLD)).body;
    const openBefore = (await admin.get<AdminIssues>('/v1/admin/issues')).body.open;

    const answered = await resolve(sent!.id, {
      refund: 10_000,
      note: 'Sorry. We have sent back ৳100 for the cold rice.',
    });
    expect(answered.status).toBe(200);

    const after = await orderOf(order.token);
    expect(after.issues[0]).toMatchObject({
      status: 'refunded',
      refund: 10_000,
      note: 'Sorry. We have sent back ৳100 for the cold rice.',
    });
    expect(after.issues[0]!.resolvedAt).not.toBeNull();
    expect(after.payment).toMatchObject({ state: 'part_refunded', refunded: 10_000 });

    expect((await admin.get<AdminIssues>('/v1/admin/issues')).body.open).toBe(
      openBefore - 1,
    );
    const answeredList = (await admin.get<AdminIssues>('/v1/admin/issues?scope=answered'))
      .body;
    expect(answeredList.issues.some((row) => row.id === sent!.id)).toBe(true);

    // The refund is on record, tied to the report and to the admin who gave it.
    const [refund] = await api.db
      .select()
      .from(refunds)
      .where(eq(refunds.issueId, sent!.id));
    expect(refund).toMatchObject({
      amount: 10_000,
      byUserId: admin.user.id,
      failed: false,
    });
  });

  it('closes a report with no refund', async () => {
    const order = await deliveredOrder();
    const {
      issues: [sent],
    } = (await report(order.token, COLD)).body;

    await resolve(sent!.id, { refund: 0, note: 'The kitchen sent a photo of the bag.' });

    const after = await orderOf(order.token);
    expect(after.issues[0]).toMatchObject({ status: 'closed', refund: 0 });
    expect(after.payment).toMatchObject({ state: 'paid', refunded: 0 });
  });

  it('never gives back more than was paid, and keeps the report open', async () => {
    const order = await deliveredOrder();
    const {
      issues: [sent],
    } = (await report(order.token, COLD)).body;

    const tooMuch = await resolve(sent!.id, {
      refund: order.total + 100,
      note: 'Too much',
    });
    expect(tooMuch.status).toBe(400);

    const after = await orderOf(order.token);
    expect(after.issues[0]).toMatchObject({ status: 'open', refund: 0, note: null });
    expect(after.payment.refunded).toBe(0);

    const [row] = await api.db.select().from(issues).where(eq(issues.id, sent!.id));
    expect(row).toMatchObject({ status: 'open', resolvedAt: null, resolvedBy: null });
  });

  it('answers a report once', async () => {
    const order = await deliveredOrder();
    const {
      issues: [sent],
    } = (await report(order.token, COLD)).body;

    await resolve(sent!.id, { refund: 0, note: 'Closed.' });
    const again = await resolve(sent!.id, { refund: 5_000, note: 'Changed my mind' });
    expect(again.status).toBe(409);
    expect((await orderOf(order.token)).payment.refunded).toBe(0);

    expect((await resolve(999_999, { refund: 0, note: 'Nothing' })).status).toBe(404);
    expect((await resolve(sent!.id, { refund: -1, note: 'Negative' })).status).toBe(400);
    expect((await resolve(sent!.id, { refund: 0, note: '' })).status).toBe(400);
  });

  it('takes another report once the last is answered, up to a limit', async () => {
    const order = await deliveredOrder();

    for (let round = 1; round <= MAX_ISSUES_PER_ORDER; round += 1) {
      const sent = await report(order.token, COLD);
      expect(sent.status, `report ${round}`).toBe(201);
      await resolve(sent.body.issues[0]!.id, { refund: 0, note: 'Looked at.' });
    }

    const after = await orderOf(order.token);
    expect(after.issues).toHaveLength(MAX_ISSUES_PER_ORDER);
    expect(after.canReport).toBe(false);
    expect((await report(order.token, COLD)).status).toBe(409);
  });

  it('sends a refund for an order paid online back through the gateway', async () => {
    const order = await deliveredOrder(ALOO, { paymentMethod: 'bkash' });
    const {
      issues: [sent],
    } = (
      await report(order.token, {
        kind: 'missing_item',
        detail: 'One of the two biryanis was not in the bag.',
      })
    ).body;

    await resolve(sent!.id, { refund: order.total, note: 'Refunded in full. Sorry.' });

    const after = await orderOf(order.token);
    expect(after.payment).toMatchObject({ state: 'refunded', refunded: order.total });

    const [refund] = await api.db
      .select()
      .from(refunds)
      .where(eq(refunds.issueId, sent!.id));
    expect(refund!.paymentId).not.toBeNull();
    expect(refund!.providerRef).toBeTruthy();
  });
});

describe('allergens', () => {
  it('lists what a dish contains, from a known list', async () => {
    const page = (await api.get<KitchenDetail>('/v1/kitchens/dum-ghor')).body;
    const dishes = page.sections.flatMap((section) => section.items);

    for (const dish of dishes) {
      for (const allergen of dish.allergens) expect(ALLERGENS).toContain(allergen);
    }
    const kacchi = dishes.find((dish) => dish.name.en === 'Mutton kacchi biryani')!;
    expect(kacchi.allergens).toEqual(['milk']);
    const water = dishes.find((dish) => dish.name.en.startsWith('Mineral water'))!;
    expect(water.allergens).toEqual([]);
  });

  it('lets an owner correct the list for their own dish', async () => {
    const menu = (await owner.get<PartnerMenu>('/v1/partner/menu')).body;
    const dish = menu.sections[0]!.items[0]!;

    const changed = await owner.patch<PartnerMenu>(`/v1/partner/items/${dish.id}`, {
      allergens: ['nuts', 'milk', 'milk'],
    });
    expect(changed.status).toBe(200);
    // Stored in the standard order, without repeats.
    expect(changed.body.sections[0]!.items[0]!.allergens).toEqual(['milk', 'nuts']);

    const page = (await api.get<KitchenDetail>('/v1/kitchens/dum-ghor')).body;
    const shown = page.sections.flatMap((section) => section.items);
    expect(shown.find((item) => item.id === dish.id)!.allergens).toEqual([
      'milk',
      'nuts',
    ]);

    const cleared = await owner.patch<PartnerMenu>(`/v1/partner/items/${dish.id}`, {
      allergens: [],
    });
    expect(cleared.body.sections[0]!.items[0]!.allergens).toEqual([]);
  });

  it('refuses an allergen it does not know, and another owner', async () => {
    const menu = (await owner.get<PartnerMenu>('/v1/partner/menu')).body;
    const dish = menu.sections[0]!.items[0]!;

    const unknown = await owner.patch(`/v1/partner/items/${dish.id}`, {
      allergens: ['dairy'],
    });
    expect(unknown.status).toBe(400);

    const stranger = await api.signIn(OTHER_OWNER);
    const refused = await stranger.patch(`/v1/partner/items/${dish.id}`, {
      allergens: ['milk'],
    });
    expect(refused.status).toBe(404);
  });
});

describe('the seeded history', () => {
  let seeded: Harness;

  beforeAll(async () => {
    seeded = await startHarness({ history: true });
  });

  afterAll(async () => {
    await seeded.close();
  });

  it('gives most kitchens a rating made of delivered orders', async () => {
    const list = (await seeded.get<KitchenList>('/v1/kitchens')).body;
    const rated = list.kitchens.filter((kitchen) => kitchen.rating.count > 0);
    expect(rated.length).toBeGreaterThan(list.kitchens.length * 0.9);

    for (const kitchen of rated) {
      expect(kitchen.rating.average).toBeGreaterThanOrEqual(1);
      expect(kitchen.rating.average).toBeLessThanOrEqual(5);
    }
  });

  it('leaves support staff a few reports to answer', async () => {
    const staff = await seeded.signIn(ADMIN);
    const open = (await staff.get<AdminIssues>('/v1/admin/issues')).body;
    expect(open.open).toBe(3);
    expect(open.issues.every((issue) => issue.status === 'open')).toBe(true);

    const answered = (await staff.get<AdminIssues>('/v1/admin/issues?scope=answered'))
      .body;
    expect(answered.issues.map((issue) => issue.status).sort()).toEqual([
      'closed',
      'refunded',
    ]);
    const refunded = answered.issues.find((issue) => issue.status === 'refunded')!;
    expect(refunded.order.payment).toMatchObject({
      state: 'part_refunded',
      refunded: refunded.refund,
    });
  });

  it('gives the demo customer a past to look at', async () => {
    const customer = await seeded.signIn(CUSTOMER);
    const { body } = await customer.get<unknown[]>('/v1/me/orders');
    expect(body.length).toBeGreaterThan(0);
  });
});
