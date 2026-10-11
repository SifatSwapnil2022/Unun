/**
 * Payment gateways. The rest of the API talks to a gateway through three calls: start
 * a payment, confirm it when the customer comes back, and refund it.
 *
 * Two gateways exist. The test gateway is part of this project: its "payment page" is a
 * page of the site where a visitor approves or declines, and no money moves. The bKash
 * gateway calls bKash's tokenized checkout. It is written from bKash's published
 * documentation and has been run only against a stand-in for their servers, never
 * against bKash itself, because that needs a merchant account.
 */
import { randomBytes } from 'node:crypto';
import { TAKA, type Paisa, type PaymentMethod, type PaymentProvider } from '@unun/core';
import type { PaymentOptionDto } from '@unun/core/contracts';
import type { BkashConfig, Config } from '../../config';
import { ApiError } from '../../http/errors';

export type StartPayment = {
  amount: Paisa;
  /** Our reference for the payment, shown on the gateway's own records. */
  invoice: string;
  payerPhone: string;
  /** Where the gateway sends the customer when they are done. */
  callbackUrl: string;
};

export type Gateway = {
  provider: PaymentProvider;
  /** Opens a payment. `url` is the gateway's page, or null when the page is ours. */
  start: (input: StartPayment) => Promise<{ ref: string | null; url: string | null }>;
  /** Asks the gateway to complete a payment the customer has approved. */
  confirm: (ref: string) => Promise<{ paid: boolean; trx: string | null }>;
  refund: (input: {
    ref: string | null;
    trx: string | null;
    amount: Paisa;
    reason: string;
  }) => Promise<{ ref: string | null }>;
};

/** bKash takes amounts as taka with two decimal places: "474.00". */
const asTaka = (amount: Paisa) => (amount / TAKA).toFixed(2);

/* The test gateway */

export const sandboxGateway: Gateway = {
  provider: 'sandbox',
  start: async () => ({ ref: null, url: null }),
  // The test gateway is settled by a call from its own page, not by asking it.
  confirm: async () => ({ paid: false, trx: null }),
  refund: async () => ({ ref: `SBX-R-${randomBytes(5).toString('hex').toUpperCase()}` }),
};

/* bKash tokenized checkout */

const BKASH_OK = '0000';
/** A granted token is good for an hour. It is renewed a little before that. */
const TOKEN_MARGIN_MS = 5 * 60_000;

type BkashAnswer = Record<string, string | undefined>;

export function createBkashGateway(
  bkash: BkashConfig,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): Gateway {
  let token: { value: string; expiresAt: number } | null = null;

  async function call(
    path: string,
    headers: Record<string, string>,
    body: Record<string, string>,
  ): Promise<BkashAnswer> {
    const response = await fetcher(`${bkash.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const answer = (await response.json().catch(() => null)) as BkashAnswer | null;
    if (!response.ok || !answer) {
      throw new Error(`bKash answered ${response.status} to ${path}`);
    }
    return answer;
  }

  async function grant(): Promise<string> {
    if (token && token.expiresAt > now()) return token.value;

    const answer = await call(
      '/tokenized/checkout/token/grant',
      { username: bkash.username, password: bkash.password },
      { app_key: bkash.appKey, app_secret: bkash.appSecret },
    );
    if (!answer.id_token) {
      throw new Error(
        `bKash did not grant a token: ${answer.statusMessage ?? 'no reason'}`,
      );
    }
    const lifetimeMs = Number(answer.expires_in ?? 3600) * 1000;
    token = { value: answer.id_token, expiresAt: now() + lifetimeMs - TOKEN_MARGIN_MS };
    return token.value;
  }

  async function signed(
    path: string,
    body: Record<string, string>,
  ): Promise<BkashAnswer> {
    return call(path, { Authorization: await grant(), 'X-APP-Key': bkash.appKey }, body);
  }

  return {
    provider: 'bkash',

    start: async ({ amount, invoice, payerPhone, callbackUrl }) => {
      const answer = await signed('/tokenized/checkout/create', {
        mode: '0011',
        payerReference: payerPhone,
        callbackURL: callbackUrl,
        amount: asTaka(amount),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: invoice,
      });
      if (answer.statusCode !== BKASH_OK || !answer.paymentID || !answer.bkashURL) {
        throw new Error(
          `bKash did not open a payment: ${answer.statusMessage ?? 'no reason'}`,
        );
      }
      return { ref: answer.paymentID, url: answer.bkashURL };
    },

    confirm: async (ref) => {
      const answer = await signed('/tokenized/checkout/execute', { paymentID: ref });
      const paid =
        answer.statusCode === BKASH_OK && answer.transactionStatus === 'Completed';
      return { paid, trx: paid ? (answer.trxID ?? null) : null };
    },

    refund: async ({ ref, trx, amount, reason }) => {
      if (!ref || !trx)
        throw new Error('A bKash refund needs the payment and its transaction.');
      const answer = await signed('/tokenized/checkout/payment/refund', {
        paymentID: ref,
        trxID: trx,
        amount: asTaka(amount),
        sku: 'order',
        reason: reason.slice(0, 250),
      });
      if (answer.statusCode !== BKASH_OK) {
        throw new Error(
          `bKash refused the refund: ${answer.statusMessage ?? 'no reason'}`,
        );
      }
      return { ref: answer.refundTrxID ?? null };
    },
  };
}

/* Choosing one */

export type Gateways = {
  /** The gateway a method is paid through right now. Fails if the method is not on offer. */
  forMethod: (method: PaymentMethod) => Gateway;
  byProvider: (provider: PaymentProvider) => Gateway;
  /** The ways to pay that are on offer, cash first. */
  options: () => PaymentOptionDto[];
};

export function createGateways(config: Config, fetcher: typeof fetch = fetch): Gateways {
  const bkash = config.bkash ? createBkashGateway(config.bkash, fetcher) : null;

  const choose = (method: PaymentMethod): Gateway | null => {
    if (method === 'bkash' && bkash) return bkash;
    return config.paymentSandbox ? sandboxGateway : null;
  };

  return {
    forMethod: (method) => {
      const gateway = method === 'cash' ? null : choose(method);
      if (!gateway) {
        throw new ApiError(
          'payment_unavailable',
          'This way of paying is not available right now. Choose another.',
        );
      }
      return gateway;
    },
    byProvider: (provider) => {
      const gateway = provider === 'bkash' ? bkash : sandboxGateway;
      if (!gateway) throw new Error(`The ${provider} gateway is not configured`);
      return gateway;
    },
    options: () => [
      { method: 'cash', sandbox: false },
      ...(['bkash', 'card'] as const).flatMap((method) => {
        const gateway = choose(method);
        return gateway ? [{ method, sandbox: gateway.provider === 'sandbox' }] : [];
      }),
    ],
  };
}
