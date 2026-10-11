/**
 * The database schema. Rules that must always hold (money is never negative, an order
 * total equals the sum of its parts) are written as CHECK constraints, so a bug in the
 * application cannot store a row that breaks them.
 */
import {
  ISSUE_KINDS,
  ISSUE_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  USER_ROLES,
} from '@unun/core';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const orderStatus = pgEnum('order_status', ORDER_STATUSES);
export const paymentMethod = pgEnum('payment_method', PAYMENT_METHODS);
export const paymentStatus = pgEnum('payment_status', PAYMENT_STATUSES);
export const paymentProvider = pgEnum('payment_provider', PAYMENT_PROVIDERS);
export const promotionKind = pgEnum('promotion_kind', [
  'free_delivery',
  'amount_off',
  'percent_off',
]);
export const promotionPayer = pgEnum('promotion_payer', ['platform', 'restaurant']);
export const userRole = pgEnum('user_role', USER_ROLES);
export const issueKind = pgEnum('issue_kind', ISSUE_KINDS);
export const issueStatus = pgEnum('issue_status', ISSUE_STATUSES);

const emptyTextArray = sql`'{}'::text[]`;

/* People */

export const users = pgTable(
  'users',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    /** Local form, 01712345678. A person signs in by proving they hold this number. */
    phone: text('phone').notNull(),
    name: text('name').notNull().default(''),
    role: userRole('role').notNull().default('customer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex('users_phone_key').on(table.phone)],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the token in the cookie. The token itself is never stored. */
    tokenHash: text('token_hash').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
);

export const loginCodes = pgTable(
  'login_codes',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    phone: text('phone').notNull(),
    /** SHA-256 of the code, keyed with the phone number. */
    codeHash: text('code_hash').notNull(),
    /** Wrong guesses so far. The code stops working after a few. */
    attempts: smallint('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [index('login_codes_phone_idx').on(table.phone, table.createdAt)],
);

/* Catalogue */

export const areas = pgTable('areas', {
  id: text('id').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameBn: text('name_bn').notNull(),
  aliases: text('aliases').array().notNull().default(emptyTextArray),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  sort: smallint('sort').notNull(),
});

export const cuisines = pgTable('cuisines', {
  id: text('id').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameBn: text('name_bn').notNull(),
  tone: text('tone').notNull(),
  photo: text('photo'),
  sort: smallint('sort').notNull(),
});

export const kitchens = pgTable(
  'kitchens',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull(),
    nameEn: text('name_en').notNull(),
    nameBn: text('name_bn').notNull(),
    taglineEn: text('tagline_en').notNull(),
    taglineBn: text('tagline_bn').notNull(),
    areaId: text('area_id')
      .notNull()
      .references(() => areas.id),
    addressEn: text('address_en').notNull(),
    addressBn: text('address_bn').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    /** Minutes the kitchen needs to cook a typical order. */
    prepMinutes: smallint('prep_minutes').notNull(),
    minOrder: integer('min_order').notNull(),
    onTimeOfTen: smallint('on_time_of_ten').notNull(),
    /** Opening hours in minutes after midnight, Dhaka time. */
    opensMinute: smallint('opens_minute').notNull(),
    closesMinute: smallint('closes_minute').notNull(),
    tags: text('tags').array().notNull().default(emptyTextArray),
    tone: text('tone').notNull(),
    /** The cover. A key in the web app's media library, like the two below it. */
    photo: text('photo'),
    profilePhoto: text('profile_photo'),
    /** Inactive kitchens are hidden from customers. Support staff set this. */
    active: boolean('active').notNull().default(true),
    /** The person who runs the kitchen and sees its orders. */
    ownerId: integer('owner_id').references(() => users.id, { onDelete: 'set null' }),
    /**
     * On: nobody is at the kitchen's screen, so the demo simulator moves its orders.
     * Off: the kitchen's staff and a rider move each order by hand.
     */
    autopilot: boolean('autopilot').notNull().default(true),
    /** The kitchen has stopped taking orders for now. Its owner sets this. */
    paused: boolean('paused').notNull().default(false),
  },
  (table) => [
    uniqueIndex('kitchens_slug_key').on(table.slug),
    index('kitchens_area_idx').on(table.areaId),
    index('kitchens_owner_idx').on(table.ownerId),
    check('kitchens_min_order_check', sql`${table.minOrder} >= 0`),
    check('kitchens_prep_check', sql`${table.prepMinutes} > 0`),
    check('kitchens_on_time_check', sql`${table.onTimeOfTen} between 0 and 10`),
    check(
      'kitchens_hours_check',
      sql`${table.opensMinute} between 0 and 1439 and ${table.closesMinute} between 0 and 1439`,
    ),
  ],
);

export const kitchenCuisines = pgTable(
  'kitchen_cuisines',
  {
    kitchenId: integer('kitchen_id')
      .notNull()
      .references(() => kitchens.id, { onDelete: 'cascade' }),
    cuisineId: text('cuisine_id')
      .notNull()
      .references(() => cuisines.id),
    sort: smallint('sort').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.kitchenId, table.cuisineId] })],
);

export const menuSections = pgTable(
  'menu_sections',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    kitchenId: integer('kitchen_id')
      .notNull()
      .references(() => kitchens.id, { onDelete: 'cascade' }),
    nameEn: text('name_en').notNull(),
    nameBn: text('name_bn').notNull(),
    sort: smallint('sort').notNull(),
  },
  (table) => [index('menu_sections_kitchen_idx').on(table.kitchenId)],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    kitchenId: integer('kitchen_id')
      .notNull()
      .references(() => kitchens.id, { onDelete: 'cascade' }),
    sectionId: integer('section_id')
      .notNull()
      .references(() => menuSections.id, { onDelete: 'cascade' }),
    nameEn: text('name_en').notNull(),
    nameBn: text('name_bn').notNull(),
    descriptionEn: text('description_en').notNull().default(''),
    descriptionBn: text('description_bn').notNull().default(''),
    /** Paisa. */
    price: integer('price').notNull(),
    photo: text('photo'),
    tags: text('tags').array().notNull().default(emptyTextArray),
    /** What the dish contains that some people avoid: milk, nuts and so on. */
    allergens: text('allergens').array().notNull().default(emptyTextArray),
    popular: boolean('popular').notNull().default(false),
    available: boolean('available').notNull().default(true),
    sort: smallint('sort').notNull(),
  },
  (table) => [
    index('menu_items_kitchen_idx').on(table.kitchenId),
    check('menu_items_price_check', sql`${table.price} > 0`),
  ],
);

export const addresses = pgTable(
  'addresses',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** What the customer calls the place: Home, Office. */
    label: text('label').notNull(),
    areaId: text('area_id')
      .notNull()
      .references(() => areas.id),
    line: text('line').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('addresses_user_idx').on(table.userId)],
);

export const promotions = pgTable(
  'promotions',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: text('code').notNull(),
    titleEn: text('title_en').notNull(),
    titleBn: text('title_bn').notNull(),
    termsEn: text('terms_en').notNull(),
    termsBn: text('terms_bn').notNull(),
    kind: promotionKind('kind').notNull(),
    value: integer('value').notNull().default(0),
    maxDiscount: integer('max_discount'),
    minSubtotal: integer('min_subtotal').notNull().default(0),
    kitchenId: integer('kitchen_id').references(() => kitchens.id, {
      onDelete: 'cascade',
    }),
    cuisineId: text('cuisine_id').references(() => cuisines.id),
    startsMinute: smallint('starts_minute'),
    endsMinute: smallint('ends_minute'),
    firstOrderOnly: boolean('first_order_only').notNull().default(false),
    paidBy: promotionPayer('paid_by').notNull(),
    /** Listed promotions are advertised on the home page. */
    listed: boolean('listed').notNull().default(true),
    active: boolean('active').notNull().default(true),
    sort: smallint('sort').notNull().default(0),
  },
  (table) => [
    uniqueIndex('promotions_code_key').on(table.code),
    check('promotions_value_check', sql`${table.value} >= 0`),
    check(
      'promotions_hours_check',
      sql`(${table.startsMinute} is null) = (${table.endsMinute} is null)`,
    ),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    /** Short reference a customer can read out on the phone: UN-7K3F9Q. */
    publicId: text('public_id').notNull(),
    /** Unguessable token in the tracking link. Whoever holds it can see the order. */
    token: text('token').notNull(),
    /** Sent by the client so a repeated request cannot create a second order. */
    idempotencyKey: text('idempotency_key'),
    kitchenId: integer('kitchen_id')
      .notNull()
      .references(() => kitchens.id),
    areaId: text('area_id')
      .notNull()
      .references(() => areas.id),
    /** The account that placed the order. Null for an order placed without signing in. */
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** The rider who took the delivery. Null on autopilot, and until a rider takes it. */
    riderId: integer('rider_id').references(() => users.id, { onDelete: 'set null' }),
    /** Copied from the kitchen when the order is placed, so a later switch cannot strand it. */
    autopilot: boolean('autopilot').notNull().default(true),
    cancelReason: text('cancel_reason'),
    /**
     * True while an online payment is unfinished. The kitchen is not told about the
     * order, and it has no events, until the payment goes through.
     */
    awaitingPayment: boolean('awaiting_payment').notNull().default(false),
    /** When the online payment went through. Null for cash, and until it does. */
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** Money given back to the customer so far, in paisa. */
    refunded: integer('refunded').notNull().default(0),
    /** The language the customer ordered in, for pages they are sent back to. */
    locale: text('locale').notNull().default('en'),
    /** Where the rider's phone last said it was, while carrying this order. */
    riderLat: doublePrecision('rider_lat'),
    riderLng: doublePrecision('rider_lng'),
    riderAt: timestamp('rider_at', { withTimezone: true }),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    address: text('address').notNull(),
    note: text('note'),
    paymentMethod: paymentMethod('payment_method').notNull(),
    promoCode: text('promo_code'),
    itemsTotal: integer('items_total').notNull(),
    discount: integer('discount').notNull(),
    deliveryFee: integer('delivery_fee').notNull(),
    deliveryDiscount: integer('delivery_discount').notNull(),
    serviceFee: integer('service_fee').notNull(),
    vat: integer('vat').notNull(),
    total: integer('total').notNull(),
    /** The promised arrival window, in minutes after the order was placed. */
    windowMin: smallint('window_min').notNull(),
    windowMax: smallint('window_max').notNull(),
    /** How much faster than real time the demo simulator ran for this order. */
    timeScale: smallint('time_scale').notNull().default(1),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('orders_public_id_key').on(table.publicId),
    uniqueIndex('orders_token_key').on(table.token),
    uniqueIndex('orders_idempotency_key').on(table.idempotencyKey),
    index('orders_phone_idx').on(table.customerPhone),
    index('orders_placed_idx').on(table.placedAt),
    index('orders_kitchen_idx').on(table.kitchenId, table.placedAt),
    index('orders_user_idx').on(table.userId),
    index('orders_rider_idx').on(table.riderId),
    check(
      'orders_amounts_check',
      sql`${table.itemsTotal} > 0 and ${table.discount} between 0 and ${table.itemsTotal}
        and ${table.deliveryFee} >= 0
        and ${table.deliveryDiscount} between 0 and ${table.deliveryFee}
        and ${table.serviceFee} >= 0 and ${table.vat} >= 0`,
    ),
    check(
      'orders_total_check',
      sql`${table.total} = ${table.itemsTotal} - ${table.discount} + ${table.deliveryFee}
        - ${table.deliveryDiscount} + ${table.serviceFee} + ${table.vat}`,
    ),
    check(
      'orders_window_check',
      sql`${table.windowMin} > 0 and ${table.windowMax} > ${table.windowMin}`,
    ),
    check('orders_time_scale_check', sql`${table.timeScale} >= 1`),
    check('orders_refunded_check', sql`${table.refunded} between 0 and ${table.total}`),
  ],
);

/** One attempt to pay for an order online. A failed attempt can be followed by another. */
export const payments = pgTable(
  'payments',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** Unguessable. It is the address of the payment page. */
    token: text('token').notNull(),
    provider: paymentProvider('provider').notNull(),
    method: paymentMethod('method').notNull(),
    amount: integer('amount').notNull(),
    status: paymentStatus('status').notNull().default('pending'),
    /** The gateway's own id for the payment, and for the completed transaction. */
    providerRef: text('provider_ref'),
    providerTrx: text('provider_trx'),
    /** The gateway's own payment page. Null when the page is part of this site. */
    redirectUrl: text('redirect_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('payments_token_key').on(table.token),
    index('payments_order_idx').on(table.orderId),
    index('payments_provider_ref_idx').on(table.providerRef),
    check('payments_amount_check', sql`${table.amount} > 0`),
  ],
);

/** Money given back. Every refund has a reason, and a person unless it was automatic. */
export const refunds = pgTable(
  'refunds',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** The online payment it went back through. Null when the order was paid in cash. */
    paymentId: integer('payment_id').references(() => payments.id, {
      onDelete: 'set null',
    }),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    /** The problem report this refund answers, if it answers one. */
    issueId: integer('issue_id').references(() => issues.id, { onDelete: 'set null' }),
    /** The admin who gave it. Null when a cancelled order was refunded automatically. */
    byUserId: integer('by_user_id').references(() => users.id, { onDelete: 'set null' }),
    providerRef: text('provider_ref'),
    /** True when the gateway refused the refund and someone must send it by hand. */
    failed: boolean('failed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('refunds_order_idx').on(table.orderId),
    check('refunds_amount_check', sql`${table.amount} > 0`),
  ],
);

/**
 * What a customer thought of a delivered order. There is at most one per order, and
 * none without an order, so a kitchen's average is made only of meals that arrived.
 */
export const ratings = pgTable(
  'ratings',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** Copied from the order, so a kitchen's ratings are read without a join. */
    kitchenId: integer('kitchen_id')
      .notNull()
      .references(() => kitchens.id, { onDelete: 'cascade' }),
    stars: smallint('stars').notNull(),
    comment: text('comment'),
    /** Support staff hide a rating that is abusive. Hidden ratings do not count. */
    hidden: boolean('hidden').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('ratings_order_key').on(table.orderId),
    index('ratings_kitchen_idx').on(table.kitchenId, table.createdAt),
    check('ratings_stars_check', sql`${table.stars} between 1 and 5`),
  ],
);

/** A customer's report that something was wrong with an order, and how it ended. */
export const issues = pgTable(
  'issues',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    kind: issueKind('kind').notNull(),
    detail: text('detail').notNull(),
    status: issueStatus('status').notNull().default('open'),
    /** What support staff wrote back to the customer. */
    note: text('note'),
    /** Paisa given back for this report. */
    refund: integer('refund').notNull().default(0),
    resolvedBy: integer('resolved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('issues_order_idx').on(table.orderId),
    index('issues_status_idx').on(table.status, table.createdAt),
    // One report at a time per order: the next can be sent once this one is answered.
    uniqueIndex('issues_one_open_key')
      .on(table.orderId)
      .where(sql`${table.status} = 'open'`),
    check('issues_refund_check', sql`${table.refund} >= 0`),
    check(
      'issues_resolved_check',
      sql`(${table.status} = 'open') = (${table.resolvedAt} is null)`,
    ),
  ],
);

export const orderLines = pgTable(
  'order_lines',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    menuItemId: integer('menu_item_id')
      .notNull()
      .references(() => menuItems.id),
    /** Name and price are copied, so a later menu change cannot rewrite a past order. */
    nameEn: text('name_en').notNull(),
    nameBn: text('name_bn').notNull(),
    unitPrice: integer('unit_price').notNull(),
    quantity: smallint('quantity').notNull(),
    lineTotal: integer('line_total').notNull(),
  },
  (table) => [
    index('order_lines_order_idx').on(table.orderId),
    check('order_lines_quantity_check', sql`${table.quantity} > 0`),
    check(
      'order_lines_total_check',
      sql`${table.lineTotal} = ${table.unitPrice} * ${table.quantity}`,
    ),
  ],
);

export const orderEvents = pgTable(
  'order_events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    status: orderStatus('status').notNull(),
    /**
     * When the order reaches this state. On autopilot every state is stored when the
     * order is placed, so this can be in the future; an order's current state is the
     * latest one whose moment has passed.
     */
    at: timestamp('at', { withTimezone: true }).notNull(),
    /** The same moment in order time: minutes after the order was placed. */
    minute: integer('minute').notNull(),
  },
  (table) => [
    uniqueIndex('order_events_order_status_key').on(table.orderId, table.status),
    index('order_events_order_at_idx').on(table.orderId, table.at),
  ],
);
