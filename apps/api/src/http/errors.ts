import type { ApiErrorBody, ApiErrorCode } from '@unun/core/contracts';

type Status = 400 | 401 | 403 | 404 | 409 | 429 | 500;

const STATUS_BY_CODE: Record<ApiErrorCode, Status> = {
  invalid_request: 400,
  invalid_phone: 400,
  invalid_code: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  unknown_area: 404,
  out_of_range: 409,
  kitchen_closed: 409,
  item_unavailable: 409,
  below_minimum: 409,
  promotion_refused: 409,
  price_changed: 409,
  payment_unavailable: 409,
  payment_closed: 409,
  invalid_transition: 409,
  already_taken: 409,
  limit_reached: 409,
  rate_limited: 429,
  internal_error: 500,
};

/** An error the client caused or can act on. It is sent to the client as written. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: Status;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}
