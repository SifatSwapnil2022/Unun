/**
 * The API contract: request schemas the server validates, and the response shapes the
 * web app reads. Both sides import this file, so they cannot drift apart.
 */
import { z } from 'zod';
import { LOGIN_CODE_LENGTH, USER_ROLES, type UserRole } from './accounts';
import { ALLERGENS, type Allergen } from './allergens';
import type { DeliveryWindow, LatLng } from './delivery';
import {
  COMMENT_MAX_LENGTH,
  ISSUE_DETAIL_MAX_LENGTH,
  ISSUE_DETAIL_MIN_LENGTH,
  ISSUE_KINDS,
  MAX_STARS,
  MIN_STARS,
  type IssueKind,
  type IssueStatus,
} from './feedback';
import { TAKA, type Paisa } from './money';
import type { ArrivalOutcome, OrderStatus } from './orders';
import type { PaymentProvider, PaymentState, PaymentStatus } from './payments';
import type { PriceBreakdown } from './pricing';
import type { PromotionPayer, PromotionRejection } from './promotions';
import {
  LOCALES,
  PAYMENT_METHODS,
  type ItemTag,
  type KitchenTag,
  type Localized,
  type PaymentMethod,
} from './types';

/* Requests */

const lineSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20),
});

export const quoteRequestSchema = z.object({
  /** Kitchen slug. */
  kitchen: z.string().min(1).max(80),
  /** Delivery area id. */
  area: z.string().min(1).max(40),
  lines: z.array(lineSchema).min(1).max(40),
  promoCode: z.string().trim().max(24).optional(),
  /** Lets a first-order promotion be checked before the customer is asked for details. */
  phone: z.string().max(24).optional(),
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const orderRequestSchema = quoteRequestSchema.extend({
  customer: z.object({
    name: z.string().trim().min(2).max(60),
    phone: z.string().min(1).max(24),
  }),
  address: z.string().trim().min(5).max(200),
  note: z.string().trim().max(200).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  /** The language the customer is using, so a payment page can send them back in it. */
  locale: z.enum(LOCALES).optional(),
  /**
   * The total the customer was shown. The order is refused if the server arrives at a
   * different total, so the customer is never charged a price they did not see.
   */
  expectedTotal: z.number().int().nonnegative(),
});

export type OrderRequest = z.infer<typeof orderRequestSchema>;

const phoneField = z.string().min(1).max(24);

/** Asks for a one-time sign-in code to be sent to a mobile number. */
export const codeRequestSchema = z.object({ phone: phoneField });

export type CodeRequest = z.infer<typeof codeRequestSchema>;

export const verifyRequestSchema = z.object({
  phone: phoneField,
  code: z
    .string()
    .min(LOGIN_CODE_LENGTH)
    .max(LOGIN_CODE_LENGTH + 6),
});

export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const addressRequestSchema = z.object({
  /** What the customer calls the place: Home, Office. */
  label: z.string().trim().min(1).max(24),
  area: z.string().min(1).max(40),
  line: z.string().trim().min(5).max(200),
});

export type AddressRequest = z.infer<typeof addressRequestSchema>;

/** A reason typed by staff when an order is declined or cancelled. */
const reasonField = z.string().trim().min(3).max(140);

export const cancelRequestSchema = z.object({ reason: reasonField });

export type CancelRequest = z.infer<typeof cancelRequestSchema>;

export const kitchenAdvanceSchema = z.object({
  to: z.enum(['accepted', 'cooking', 'ready']),
});

export type KitchenAdvance = z.infer<typeof kitchenAdvanceSchema>;

export const riderAdvanceSchema = z.object({
  to: z.enum(['picked_up', 'delivered']),
});

export type RiderAdvance = z.infer<typeof riderAdvanceSchema>;

/** What the test gateway is told to do with a payment. */
export const sandboxOutcomeSchema = z.object({
  outcome: z.enum(['approve', 'decline', 'cancel']),
});

export type SandboxOutcome = z.infer<typeof sandboxOutcomeSchema>['outcome'];

/** Where a rider's phone says it is. */
export const riderLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type RiderLocation = z.infer<typeof riderLocationSchema>;

const atLeastOneField = (value: Record<string, unknown>) =>
  Object.values(value).some((field) => field !== undefined);

export const kitchenSettingsSchema = z
  .object({
    /** On: the simulator moves this kitchen's orders. Off: staff do, by hand. */
    autopilot: z.boolean().optional(),
    /** On: the kitchen takes no new orders. */
    paused: z.boolean().optional(),
  })
  .refine(atLeastOneField, { message: 'Nothing to change.' });

export type KitchenSettings = z.infer<typeof kitchenSettingsSchema>;

/** Menu prices are whole taka between ৳10 and ৳5,000. */
export const MIN_ITEM_PRICE: Paisa = 10 * TAKA;
export const MAX_ITEM_PRICE: Paisa = 5000 * TAKA;

export const itemUpdateSchema = z
  .object({
    available: z.boolean().optional(),
    price: z
      .number()
      .int()
      .min(MIN_ITEM_PRICE)
      .max(MAX_ITEM_PRICE)
      .multipleOf(TAKA)
      .optional(),
    /** Everything the dish contains that some people avoid. Replaces the old list. */
    allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length).optional(),
  })
  .refine(atLeastOneField, { message: 'Nothing to change.' });

export type ItemUpdate = z.infer<typeof itemUpdateSchema>;

/** A customer's rating of a delivered order. */
export const ratingRequestSchema = z.object({
  stars: z.number().int().min(MIN_STARS).max(MAX_STARS),
  comment: z.string().trim().max(COMMENT_MAX_LENGTH).optional(),
});

export type RatingRequest = z.infer<typeof ratingRequestSchema>;

/** A customer's report that something was wrong with a delivered order. */
export const issueRequestSchema = z.object({
  kind: z.enum(ISSUE_KINDS),
  detail: z.string().trim().min(ISSUE_DETAIL_MIN_LENGTH).max(ISSUE_DETAIL_MAX_LENGTH),
});

export type IssueRequest = z.infer<typeof issueRequestSchema>;

/** What support staff decide about a report: how much goes back, and what to tell the customer. */
export const issueResolveSchema = z.object({
  /** Paisa to give back. Zero closes the report without a refund. */
  refund: z.number().int().nonnegative(),
  note: z.string().trim().min(3).max(300),
});

export type IssueResolve = z.infer<typeof issueResolveSchema>;

export const reviewModerationSchema = z.object({ hidden: z.boolean() });

export type ReviewModeration = z.infer<typeof reviewModerationSchema>;

export const adminKitchenUpdateSchema = z
  .object({
    /** Inactive kitchens are hidden from customers. */
    active: z.boolean().optional(),
    /** The user who runs the kitchen, or null for nobody. */
    ownerId: z.number().int().positive().nullable().optional(),
  })
  .refine(atLeastOneField, { message: 'Nothing to change.' });

export type AdminKitchenUpdate = z.infer<typeof adminKitchenUpdateSchema>;

export const adminUserUpdateSchema = z.object({ role: z.enum(USER_ROLES) });

export type AdminUserUpdate = z.infer<typeof adminUserUpdateSchema>;

/* Responses */

export type AreaDto = {
  id: string;
  name: Localized;
  /** Other names people type for the area: neighbourhoods and landmarks. */
  aliases: string[];
};

export type CuisineDto = {
  id: string;
  name: Localized;
  /** Colour classes for the cuisine tile. */
  tone: string;
  photo: string | null;
  kitchens: number;
};

export type KitchenDelivery = {
  /** The area the figures are worked out for. */
  areaId: string;
  km: number;
  fee: Paisa;
  window: DeliveryWindow;
  /**
   * Where the window came from: the model that has learned from past deliveries, or
   * the plain rule that is used when the model is not running.
   */
  estimate: 'model' | 'formula';
};

/** What customers who received their food thought of a kitchen. */
export type RatingSummary = {
  /** One decimal place. Null until somebody has rated. */
  average: number | null;
  count: number;
};

/** A rating as the public sees it. Every one comes from a delivered order. */
export type ReviewDto = {
  id: number;
  stars: number;
  comment: string | null;
  /** First name and one initial. */
  author: string;
  at: string;
  /** What the reviewer ordered, dearest first. */
  dishes: Localized[];
};

export type KitchenSummary = {
  slug: string;
  name: Localized;
  tagline: Localized;
  area: { id: string; name: Localized };
  cuisines: Array<{ id: string; name: Localized }>;
  tone: string;
  /** Keys in the web app's media library: the wide cover and the small round profile. */
  photo: string | null;
  profilePhoto: string | null;
  tags: KitchenTag[];
  /** How many of the last ten orders arrived inside the promised window. */
  onTimeOfTen: number;
  rating: RatingSummary;
  minOrder: Paisa;
  /** Opening hours in minutes after midnight, Dhaka time. */
  hours: { opens: number; closes: number };
  isOpen: boolean;
  delivery: KitchenDelivery;
  /** In search results: the dishes on this kitchen's menu that matched the search. */
  matched?: Localized[];
};

export type MenuItemDto = {
  id: number;
  name: Localized;
  description: Localized;
  price: Paisa;
  photo: string | null;
  tags: ItemTag[];
  /** What the dish contains that some people avoid, as the kitchen declared it. */
  allergens: Allergen[];
  popular: boolean;
  available: boolean;
};

export type MenuSectionDto = {
  id: number;
  name: Localized;
  items: MenuItemDto[];
};

export type KitchenDetail = KitchenSummary & {
  address: Localized;
  /** The charges added to every order, so the bag can show the full price at once. */
  pricing: { serviceFee: Paisa; vatRate: number };
  sections: MenuSectionDto[];
  reviews: {
    /** How many ratings of each size there are: one star first, five stars last. */
    byStars: [number, number, number, number, number];
    /** The newest ratings that came with a comment. */
    latest: ReviewDto[];
  };
};

export type KitchenList = {
  area: { id: string; name: Localized } | null;
  total: number;
  kitchens: KitchenSummary[];
  /**
   * How a search was answered. "model" understands other spellings and both scripts and
   * ranks by closeness; "basic" matches the letters as typed. Null without a search.
   */
  search: 'model' | 'basic' | null;
};

/** Dishes from one kitchen that go with what is in the bag. */
export type PairingsDto = {
  /** "model": found in past orders. "popular": the kitchen's best sellers, as a fallback. */
  source: 'model' | 'popular';
  items: MenuItemDto[];
};

/** Kitchens picked for a signed-in customer from what they have ordered before. */
export type RecommendationsDto = {
  /** The dish from their history that the picks lean on most. */
  because: Localized | null;
  kitchens: KitchenSummary[];
};

export type OfferDto = {
  code: string;
  title: Localized;
  terms: Localized;
  paidBy: PromotionPayer;
};

export type PricedLine = {
  itemId: number;
  name: Localized;
  unitPrice: Paisa;
  quantity: number;
  total: Paisa;
};

export type QuoteDto = {
  kitchen: { slug: string; name: Localized; minOrder: Paisa; isOpen: boolean };
  area: { id: string; name: Localized };
  lines: PricedLine[];
  breakdown: PriceBreakdown;
  window: DeliveryWindow;
  /** Where the window came from. See KitchenDelivery. */
  estimate: 'model' | 'formula';
  promotion:
    | { code: string; applied: true }
    | { code: string; applied: false; reason: PromotionRejection }
    | null;
  /** False when the food cost is below the kitchen's minimum order. */
  meetsMinimum: boolean;
};

export type OrderEventDto = {
  status: OrderStatus;
  /** ISO 8601 instant. */
  at: string;
};

/** The payment a customer still has to finish, and where to finish it. */
export type OpenPayment = {
  token: string;
  /** The gateway's own page. Null for the test gateway, whose page is part of this site. */
  url: string | null;
};

export type OrderPaymentDto = {
  method: PaymentMethod;
  state: PaymentState;
  /** Money given back so far. */
  refunded: Paisa;
  /** While an online payment is unfinished: when the order lapses if it stays unpaid. */
  payBy: string | null;
  /** The attempt in progress, if there is one. After a failed attempt there is none. */
  open: OpenPayment | null;
};

/** What the tracking map draws. */
export type OrderMapDto = {
  kitchen: LatLng;
  /** The centre of the delivery area. Street addresses are not placed on the map yet. */
  destination: LatLng;
  /**
   * Where the rider is once they have the food. "gps" comes from the rider's phone;
   * "estimate" is worked out from when they left and how far they have to go.
   */
  rider: { position: LatLng; source: 'gps' | 'estimate' } | null;
  /** Minutes until the food should arrive, while the rider is on the way. */
  etaMinutes: number | null;
};

/** A problem a customer reported, and what came of it. */
export type IssueDto = {
  id: number;
  kind: IssueKind;
  detail: string;
  status: IssueStatus;
  createdAt: string;
  resolvedAt: string | null;
  /** What support staff wrote back. */
  note: string | null;
  /** Money given back for this report. */
  refund: Paisa;
};

export type OrderRatingDto = { stars: number; comment: string | null; at: string };

export type OrderDto = {
  publicId: string;
  token: string;
  status: OrderStatus;
  kitchen: { slug: string; name: Localized; area: Localized };
  lines: PricedLine[];
  breakdown: PriceBreakdown;
  payment: OrderPaymentDto;
  map: OrderMapDto;
  customer: { name: string; phone: string };
  deliverTo: { area: Localized; address: string; note: string | null };
  promoCode: string | null;
  placedAt: string;
  /** The arrival window the customer was promised, as two instants. */
  promisedFrom: string;
  promisedTo: string;
  /** States the order has already reached, oldest first. */
  events: OrderEventDto[];
  /** Null until delivery; then how the arrival compares with the promised window. */
  arrival: ArrivalOutcome | null;
  /** Who moves this order along: the demo simulator, or the kitchen's staff and a rider. */
  handledBy: OrderHandling;
  /** The rider's first name, once one has taken the order. */
  rider: { name: string } | null;
  /** Why the order was cancelled, when it was. */
  cancelReason: string | null;
  /** How much faster than real time the demo simulator runs. 1 means real time. */
  demoSpeed: number;
  rating: OrderRatingDto | null;
  canRate: boolean;
  /** Problems reported on this order, newest first. */
  issues: IssueDto[];
  canReport: boolean;
};

export type OrderHandling = 'autopilot' | 'people';

export type OrderCreated = {
  publicId: string;
  token: string;
  /** The payment to finish before the kitchen is told. Null for cash. */
  payment: OpenPayment | null;
};

/** One attempt to pay for an order online. */
export type PaymentDto = {
  token: string;
  method: PaymentMethod;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: Paisa;
  /** When an unfinished payment lapses and the order is cancelled. */
  expiresAt: string;
  order: { publicId: string; token: string; kitchen: Localized };
};

/** A way to pay that is on offer right now. */
export type PaymentOptionDto = {
  method: PaymentMethod;
  /** True when it goes through the test gateway and no money moves. */
  sandbox: boolean;
};

/* Accounts */

export type UserDto = {
  id: number;
  name: string;
  /** Local form: 01712345678. */
  phone: string;
  role: UserRole;
};

export type SessionDto = { user: UserDto | null };

export type CodeSent = {
  expiresInSeconds: number;
  /**
   * The code itself, when the API runs in demo mode with no SMS gateway. Null in
   * production, where the code only ever travels by SMS.
   */
  demoCode: string | null;
};

/** A seeded account a visitor can sign in to, to try each workspace. */
export type DemoAccountDto = {
  role: UserRole;
  name: string;
  phone: string;
  /** The kitchen an owner account runs. */
  kitchen: Localized | null;
};

export type AddressDto = {
  id: number;
  label: string;
  area: { id: string; name: Localized };
  line: string;
};

export type OrderLineSummary = { name: Localized; quantity: number };

/** One row of a customer's order history. */
export type OrderSummaryDto = {
  publicId: string;
  token: string;
  status: OrderStatus;
  kitchen: { slug: string; name: Localized };
  lines: OrderLineSummary[];
  total: Paisa;
  paymentState: PaymentState;
  placedAt: string;
};

/* Workspaces: what kitchen staff, riders and support staff see */

/** An order as the people who handle it see it. */
export type WorkOrderDto = {
  publicId: string;
  status: OrderStatus;
  handledBy: OrderHandling;
  placedAt: string;
  /** The end of the arrival window the customer was promised. */
  promisedTo: string;
  kitchen: { slug: string; name: Localized; address: Localized; area: Localized };
  lines: OrderLineSummary[];
  /** The food cost, which is what the kitchen is paid on. */
  itemsTotal: Paisa;
  /** What the customer pays the rider. */
  total: Paisa;
  /** What the rider earns for this delivery. */
  riderPay: Paisa;
  payment: { method: PaymentMethod; state: PaymentState; refunded: Paisa };
  /** Cash the rider takes at the door. Nothing when the order was paid online. */
  collect: Paisa;
  /** Where the kitchen is, and the centre of the area the food is going to. */
  map: { kitchen: LatLng; destination: LatLng };
  /** The phone number is masked unless the viewer needs it to reach the customer. */
  customer: { name: string; phone: string };
  deliverTo: { area: Localized; address: string; note: string | null };
  rider: { name: string } | null;
  cancelReason: string | null;
};

export type PartnerKitchenDto = {
  slug: string;
  name: Localized;
  area: Localized;
  autopilot: boolean;
  paused: boolean;
  /** Whether customers can order right now: inside opening hours and not paused. */
  isOpen: boolean;
  hours: { opens: number; closes: number };
};

export type PartnerBoard = {
  kitchen: PartnerKitchenDto;
  /** Orders still in the kitchen or on the road, oldest first. */
  active: WorkOrderDto[];
  /** The latest finished orders, newest first. */
  recent: WorkOrderDto[];
  today: { orders: number; sales: Paisa };
  rating: RatingSummary;
  /** The newest ratings, with or without a comment. */
  reviews: ReviewDto[];
};

export type PartnerMenu = {
  kitchen: { slug: string; name: Localized };
  sections: MenuSectionDto[];
};

export type RiderBoard = {
  /** The delivery the rider is on, if any. A rider carries one order at a time. */
  active: WorkOrderDto | null;
  /** Orders waiting for a rider, oldest first. */
  available: WorkOrderDto[];
  recent: WorkOrderDto[];
  today: { deliveries: number; earned: Paisa; cashCollected: Paisa };
};

export type OrderTotals = {
  orders: number;
  delivered: number;
  cancelled: number;
  /** Money taken for delivered orders. */
  sales: Paisa;
};

export type AdminOverview = {
  today: OrderTotals;
  week: OrderTotals & {
    /** Share of delivered orders that were not late, from 0 to 1. Null with none delivered. */
    onTimeShare: number | null;
  };
  /** Orders that are neither delivered nor cancelled right now. */
  inProgress: number;
  /** Problem reports nobody has answered yet. */
  openIssues: number;
  kitchens: { total: number; hidden: number; paused: number; byHand: number };
  people: Record<UserRole, number>;
  /** The last seven days in Dhaka, oldest first. */
  days: Array<{ date: string; orders: number; sales: Paisa }>;
};

/** Whether the Python service is answering, and what it has loaded. */
export type AdminSystem = {
  ml:
    | { running: false }
    | {
        running: true;
        /** The arrival-time model. Not ready while it is still being trained. */
        delivery: { ready: boolean; version: string | null; trainedOn: string | null };
        search: { kitchens: number; dishes: number };
        pairings: { baskets: number };
      };
};

export type AdminOrderDto = WorkOrderDto & {
  /** Opens the customer's tracking page. */
  token: string;
};

export type AdminOrders = { total: number; orders: AdminOrderDto[] };

/** A problem report with what support staff need to decide it. */
export type AdminIssueDto = IssueDto & {
  order: {
    publicId: string;
    /** Opens the customer's tracking page. */
    token: string;
    kitchen: Localized;
    lines: OrderLineSummary[];
    total: Paisa;
    /** The most that can still be given back. */
    refundable: Paisa;
    payment: { method: PaymentMethod; state: PaymentState; refunded: Paisa };
    customer: { name: string; phone: string };
    deliveredAt: string | null;
    arrival: ArrivalOutcome | null;
  };
};

export type AdminIssues = { open: number; issues: AdminIssueDto[] };

export type AdminReviewDto = ReviewDto & {
  /** Hidden reviews are not shown to customers and do not count in the average. */
  hidden: boolean;
  kitchen: { slug: string; name: Localized };
  order: { publicId: string; token: string };
};

export type AdminReviews = { total: number; reviews: AdminReviewDto[] };

export type AdminKitchenDto = {
  slug: string;
  name: Localized;
  area: Localized;
  active: boolean;
  paused: boolean;
  autopilot: boolean;
  owner: { id: number; name: string; phone: string } | null;
  ordersThisWeek: number;
};

export type AdminUserDto = UserDto & {
  joinedAt: string;
  orders: number;
  /** English names of the kitchens an owner runs. */
  kitchens: string[];
};

export type ApiErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_code'
  | 'invalid_transition'
  | 'already_taken'
  | 'limit_reached'
  | 'not_found'
  | 'unknown_area'
  | 'out_of_range'
  | 'kitchen_closed'
  | 'item_unavailable'
  | 'below_minimum'
  | 'invalid_phone'
  | 'promotion_refused'
  | 'price_changed'
  | 'payment_unavailable'
  | 'payment_closed'
  | 'rate_limited'
  | 'internal_error';

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};
