/**
 * The one place the web app talks to the API. On the server it calls the API directly;
 * in the browser it calls /api/*, which Next forwards, so the browser only ever talks
 * to one origin and the session cookie stays first-party.
 */
import type { UserRole } from '@unun/core';
import type {
  AddressDto,
  AddressRequest,
  AdminIssues,
  AdminKitchenDto,
  AdminKitchenUpdate,
  AdminOrders,
  AdminOverview,
  AdminReviews,
  AdminSystem,
  AdminUserDto,
  ApiErrorBody,
  ApiErrorCode,
  AreaDto,
  CodeSent,
  CuisineDto,
  DemoAccountDto,
  IssueRequest,
  IssueResolve,
  ItemUpdate,
  KitchenAdvance,
  KitchenDetail,
  KitchenList,
  KitchenSettings,
  OfferDto,
  OpenPayment,
  OrderCreated,
  OrderDto,
  OrderRequest,
  OrderSummaryDto,
  PartnerBoard,
  PartnerKitchenDto,
  PairingsDto,
  PartnerMenu,
  PaymentDto,
  PaymentOptionDto,
  QuoteDto,
  QuoteRequest,
  RatingRequest,
  RecommendationsDto,
  RiderAdvance,
  RiderBoard,
  RiderLocation,
  SandboxOutcome,
  SessionDto,
} from '@unun/core/contracts';

const baseUrl =
  typeof window === 'undefined'
    ? (process.env.API_URL ?? 'http://localhost:4000')
    : '/api';

export class ApiRequestError extends Error {
  /** 0 when no response arrived at all. */
  readonly status: number;
  readonly code: ApiErrorCode | 'network';
  readonly details: unknown;

  constructor(
    status: number,
    code: ApiErrorCode | 'network',
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type KitchenQuery = {
  area?: string;
  cuisine?: string;
  q?: string;
  sort?: string;
};

function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

const segment = encodeURIComponent;

/**
 * Builds the API client. In the browser the session cookie travels by itself. On the
 * server there is no browser, so the caller passes the visitor's cookie as a header
 * (see session.server.ts).
 */
export function createApi(sessionHeaders: Record<string, string> = {}) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        cache: 'no-store',
        ...init,
        headers: { ...sessionHeaders, ...init.headers },
      });
    } catch {
      throw new ApiRequestError(0, 'network', 'The API could not be reached.');
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = (body as ApiErrorBody | null)?.error;
      throw new ApiRequestError(
        response.status,
        error?.code ?? 'internal_error',
        error?.message ?? `The API answered ${response.status}.`,
        error?.details,
      );
    }
    return body as T;
  }

  /** Sends a request that changes something. The API only accepts these as JSON. */
  const send = <T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown = {},
    headers: Record<string, string> = {},
    signal?: AbortSignal,
  ) =>
    request<T>(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });

  return {
    /* Catalogue */
    areas: () => request<AreaDto[]>('/v1/areas'),
    cuisines: () => request<CuisineDto[]>('/v1/cuisines'),
    offers: () => request<OfferDto[]>('/v1/offers'),
    kitchens: (query: KitchenQuery = {}) =>
      request<KitchenList>(`/v1/kitchens${queryString(query)}`),
    kitchen: (slug: string, area?: string) =>
      request<KitchenDetail>(`/v1/kitchens/${segment(slug)}${queryString({ area })}`),
    /** Dishes from this kitchen that go with the ones in the bag. */
    pairings: (slug: string, itemIds: number[], signal?: AbortSignal) =>
      request<PairingsDto>(
        `/v1/kitchens/${segment(slug)}/pairings${queryString({ items: itemIds.join(',') })}`,
        { signal },
      ),

    /* Orders */
    quote: (body: QuoteRequest, signal?: AbortSignal) =>
      send<QuoteDto>('POST', '/v1/quotes', body, {}, signal),
    placeOrder: (body: OrderRequest, idempotencyKey: string) =>
      send<OrderCreated>('POST', '/v1/orders', body, {
        'Idempotency-Key': idempotencyKey,
      }),
    order: (token: string) => request<OrderDto>(`/v1/orders/${segment(token)}`),
    /** Both answer with the order as it stands afterwards. */
    rateOrder: (token: string, body: RatingRequest) =>
      send<OrderDto>('POST', `/v1/orders/${segment(token)}/rating`, body),
    reportIssue: (token: string, body: IssueRequest) =>
      send<OrderDto>('POST', `/v1/orders/${segment(token)}/issues`, body),

    /* Paying online */
    paymentOptions: () => request<PaymentOptionDto[]>('/v1/payment-options'),
    payment: (token: string) => request<PaymentDto>(`/v1/payments/${segment(token)}`),
    settleSandbox: (token: string, outcome: SandboxOutcome) =>
      send<PaymentDto>('POST', `/v1/payments/${segment(token)}/sandbox`, { outcome }),
    /** Starts a new attempt to pay for an order that is still waiting. */
    payOrder: (orderToken: string) =>
      send<OpenPayment>('POST', `/v1/orders/${segment(orderToken)}/pay`),

    /* Signing in, and the signed-in person */
    requestCode: (phone: string) => send<CodeSent>('POST', '/v1/auth/code', { phone }),
    verifyCode: (phone: string, code: string) =>
      send<SessionDto>('POST', '/v1/auth/verify', { phone, code }),
    signOut: () => send<SessionDto>('POST', '/v1/auth/signout'),
    demoAccounts: () => request<DemoAccountDto[]>('/v1/auth/demo-accounts'),
    me: () => request<SessionDto>('/v1/me'),
    updateName: (name: string) => send<SessionDto>('PATCH', '/v1/me', { name }),
    myOrders: () => request<OrderSummaryDto[]>('/v1/me/orders'),
    recommendations: (area?: string) =>
      request<RecommendationsDto>(`/v1/me/recommendations${queryString({ area })}`),
    addresses: () => request<AddressDto[]>('/v1/me/addresses'),
    addAddress: (body: AddressRequest) =>
      send<AddressDto[]>('POST', '/v1/me/addresses', body),
    removeAddress: (id: number) => send<AddressDto[]>('DELETE', `/v1/me/addresses/${id}`),

    /* The restaurant owner's workspace */
    partnerKitchens: () => request<PartnerKitchenDto[]>('/v1/partner/kitchens'),
    partnerBoard: (kitchen?: string) =>
      request<PartnerBoard>(`/v1/partner/board${queryString({ kitchen })}`),
    updateKitchenSettings: (slug: string, settings: KitchenSettings) =>
      send<PartnerKitchenDto>('PATCH', `/v1/partner/kitchens/${segment(slug)}`, settings),
    partnerMenu: (kitchen?: string) =>
      request<PartnerMenu>(`/v1/partner/menu${queryString({ kitchen })}`),
    updateItem: (id: number, update: ItemUpdate) =>
      send<PartnerMenu>('PATCH', `/v1/partner/items/${id}`, update),
    kitchenAdvance: (publicId: string, to: KitchenAdvance['to']) =>
      send<{ ok: true }>('POST', `/v1/partner/orders/${segment(publicId)}/advance`, {
        to,
      }),
    declineOrder: (publicId: string, reason: string) =>
      send<{ ok: true }>('POST', `/v1/partner/orders/${segment(publicId)}/decline`, {
        reason,
      }),

    /* The rider's workspace */
    riderBoard: () => request<RiderBoard>('/v1/rider/board'),
    claimDelivery: (publicId: string) =>
      send<{ ok: true }>('POST', `/v1/rider/orders/${segment(publicId)}/claim`),
    reportLocation: (position: RiderLocation) =>
      send<{ tracked: boolean }>('POST', '/v1/rider/location', position),
    riderAdvance: (publicId: string, to: RiderAdvance['to']) =>
      send<{ ok: true }>('POST', `/v1/rider/orders/${segment(publicId)}/advance`, { to }),

    /* The admin workspace */
    adminOverview: () => request<AdminOverview>('/v1/admin/overview'),
    adminSystem: () => request<AdminSystem>('/v1/admin/system'),
    adminOrders: (query: { scope?: string; q?: string } = {}) =>
      request<AdminOrders>(`/v1/admin/orders${queryString(query)}`),
    cancelOrder: (publicId: string, reason: string) =>
      send<{ ok: true }>('POST', `/v1/admin/orders/${segment(publicId)}/cancel`, {
        reason,
      }),
    adminIssues: (scope?: string) =>
      request<AdminIssues>(`/v1/admin/issues${queryString({ scope })}`),
    resolveIssue: (id: number, body: IssueResolve) =>
      send<{ ok: true }>('POST', `/v1/admin/issues/${id}/resolve`, body),
    adminReviews: (scope?: string) =>
      request<AdminReviews>(`/v1/admin/reviews${queryString({ scope })}`),
    moderateReview: (id: number, hidden: boolean) =>
      send<{ ok: true }>('PATCH', `/v1/admin/reviews/${id}`, { hidden }),
    adminKitchens: () => request<AdminKitchenDto[]>('/v1/admin/kitchens'),
    updateKitchen: (slug: string, update: AdminKitchenUpdate) =>
      send<AdminKitchenDto[]>('PATCH', `/v1/admin/kitchens/${segment(slug)}`, update),
    adminUsers: (query: { role?: string; q?: string } = {}) =>
      request<AdminUserDto[]>(`/v1/admin/users${queryString(query)}`),
    changeRole: (id: number, role: UserRole) =>
      send<AdminUserDto>('PATCH', `/v1/admin/users/${id}`, { role }),
  };
}

export type Api = ReturnType<typeof createApi>;

/** The client for the browser, and for server code that needs no session. */
export const api = createApi();

/** True when the error means "that area does not exist", so the caller can drop it. */
export function isUnknownArea(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === 'unknown_area';
}

/** The API's error code, or "network" when no answer arrived or the error is not ours. */
export function errorCode(error: unknown): ApiErrorCode | 'network' {
  return error instanceof ApiRequestError ? error.code : 'network';
}
