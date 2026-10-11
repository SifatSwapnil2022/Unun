'use client';

import { isOnline, normaliseMobile, type PaymentMethod } from '@unun/core';
import type {
  AddressDto,
  ApiErrorCode,
  AreaDto,
  OrderCreated,
  OrderRequest,
  PaymentOptionDto,
  QuoteDto,
  QuoteRequest,
  UserDto,
} from '@unun/core/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useBag } from '@/components/bag/useBag';
import { GoesWith } from '@/components/kitchen/GoesWith';
import { Receipt } from '@/components/ui/Receipt';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { ApiRequestError, api } from '@/lib/api';
import { rememberArea } from '@/lib/area';
import type { Bag } from '@/lib/bag';
import { formatNumber, formatTaka } from '@/lib/format';
import { receiptCharges } from '@/lib/receipt';
import {
  saveCustomer,
  useHydrated,
  useSavedCustomer,
  type SavedCustomer,
} from './saved-customer';

type CheckoutProps = {
  locale: Locale;
  areas: AreaDto[];
  /** The area remembered from browsing, if any. */
  initialAreaId: string | null;
  /** The signed-in customer, whose order is kept in their account. */
  user: UserDto | null;
  /** Their saved addresses. Empty for a visitor. */
  addresses: AddressDto[];
  /** The ways to pay that are on offer. Cash is always among them. */
  paymentOptions: PaymentOptionDto[];
  signInLabel: string;
  copy: Dictionary['checkout'];
  pricingCopy: Dictionary['pricing'];
  /** Words for the dishes suggested beside the bag. */
  suggestCopy: { heading: string; add: string; addItem: string };
};

export function Checkout(props: CheckoutProps) {
  const { locale, copy } = props;
  const router = useRouter();
  const { bag, clear } = useBag();
  const saved = useSavedCustomer();
  const hydrated = useHydrated();
  const [placing, setPlacing] = useState(false);

  // The bag lives in the browser, so the server cannot know whether it is empty.
  if (!hydrated) return <div className="min-h-[60vh]" />;

  if (placing) {
    return (
      <p role="status" className="display min-h-[60vh] text-section">
        {copy.placing}
      </p>
    );
  }

  if (!bag.kitchen || bag.lines.length === 0) {
    return (
      <div className="min-h-[50vh]">
        <h1 className="display text-section max-w-[16ch]">{copy.emptyTitle}</h1>
        <p className="mt-5 max-w-[44ch] text-xl">{copy.emptyBody}</p>
        <Link href={`/${locale}/kitchens`} className="btn btn-dark mt-8">
          {copy.browse}
        </Link>
      </div>
    );
  }

  return (
    <CheckoutForm
      {...props}
      bag={bag}
      saved={saved}
      onPlaced={(created) => {
        setPlacing(true);
        clear();
        // Cash goes straight to the order. Anything else goes to be paid first: at
        // the gateway's own page, or at the test gateway, which is a page of this site.
        if (!created.payment) router.push(`/${locale}/orders/${created.token}`);
        else if (created.payment.url) window.location.assign(created.payment.url);
        else router.push(`/${locale}/pay/${created.payment.token}`);
      }}
    />
  );
}

type QuoteResult = {
  /** The request this answer belongs to. An answer to an older request is ignored. */
  key: string;
  quote: QuoteDto | null;
  error: ApiErrorCode | 'network' | null;
};

type FieldName = 'area' | 'address' | 'name' | 'phone';

function newIdempotencyKey(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The saved address the form starts with: the one in the area the customer has been
 * browsing, or their first one if they have not chosen an area yet.
 */
function startingAddress(
  addresses: AddressDto[],
  initialAreaId: string | null,
): AddressDto | null {
  const inArea = addresses.find((address) => address.area.id === initialAreaId);
  return inArea ?? (initialAreaId ? null : (addresses[0] ?? null));
}

function CheckoutForm({
  locale,
  areas,
  initialAreaId,
  user,
  addresses,
  paymentOptions,
  signInLabel,
  copy,
  pricingCopy,
  suggestCopy,
  bag,
  saved,
  onPlaced,
}: CheckoutProps & {
  bag: Bag;
  saved: SavedCustomer;
  onPlaced: (created: OrderCreated) => void;
}) {
  const ids = {
    area: useId(),
    address: useId(),
    name: useId(),
    phone: useId(),
    note: useId(),
    offer: useId(),
  };

  const [start] = useState(() => startingAddress(addresses, initialAreaId));
  const [areaId, setAreaId] = useState(
    start?.area.id ??
      (areas.some((area) => area.id === initialAreaId) ? (initialAreaId ?? '') : ''),
  );
  const [address, setAddress] = useState(start?.line ?? saved.address);
  const [name, setName] = useState(user?.name || saved.name);
  const [phone, setPhone] = useState(user?.phone ?? saved.phone);
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [offerInput, setOfferInput] = useState('');
  const [offerCode, setOfferCode] = useState('');

  const [result, setResult] = useState<QuoteResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotency = useRef<{ signature: string; key: string } | null>(null);

  const kitchen = bag.kitchen;
  const kitchenName = kitchen?.name[locale] ?? '';
  const mobile = normaliseMobile(phone);

  const quoteRequest: QuoteRequest | null =
    kitchen && areaId
      ? {
          kitchen: kitchen.slug,
          area: areaId,
          lines: bag.lines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
          })),
          promoCode: offerCode || undefined,
          phone: mobile ?? undefined,
        }
      : null;
  const requestKey = quoteRequest ? JSON.stringify(quoteRequest) : '';

  useEffect(() => {
    if (!requestKey) return;

    const controller = new AbortController();
    // A short wait, so changing a quantity several times asks for one price, not five.
    const timer = window.setTimeout(() => {
      api
        .quote(JSON.parse(requestKey) as QuoteRequest, controller.signal)
        .then((quote) => setResult({ key: requestKey, quote, error: null }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setResult({
            key: requestKey,
            quote: null,
            error: error instanceof ApiRequestError ? error.code : 'network',
          });
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey]);

  const current = requestKey !== '' && result?.key === requestKey ? result : null;
  const quote = current?.quote ?? null;
  const total = quote ? formatTaka(quote.breakdown.total, locale) : null;
  const areaName = areas.find((area) => area.id === areaId)?.name[locale] ?? '';

  const quoteProblem = (() => {
    if (!current?.error) return null;
    if (current.error === 'out_of_range') {
      return fill(copy.errors.outOfRange, { kitchen: kitchenName, area: areaName });
    }
    if (current.error === 'item_unavailable') return copy.errors.itemUnavailable;
    return copy.errors.quote;
  })();

  const blocker = (() => {
    if (!quote) return null;
    if (!quote.kitchen.isOpen) return fill(copy.errors.closed, { kitchen: kitchenName });
    if (!quote.meetsMinimum) return copy.errors.belowMinimum;
    return null;
  })();

  const validate = (): Partial<Record<FieldName, string>> => {
    const errors: Partial<Record<FieldName, string>> = {};
    if (!areaId) errors.area = copy.errors.area;
    if (address.trim().length < 5) errors.address = copy.errors.address;
    if (name.trim().length < 2) errors.name = copy.errors.name;
    if (!mobile) errors.phone = copy.errors.phone;
    return errors;
  };

  const describeFailure = (error: unknown): string => {
    if (!(error instanceof ApiRequestError)) return copy.errors.generic;

    switch (error.code) {
      case 'price_changed': {
        const fresh = (error.details as { quote?: QuoteDto } | undefined)?.quote;
        if (!fresh) return copy.errors.generic;
        setResult({ key: requestKey, quote: fresh, error: null });
        return fill(copy.errors.priceChanged, {
          total: formatTaka(fresh.breakdown.total, locale),
        });
      }
      case 'out_of_range':
        return fill(copy.errors.outOfRange, { kitchen: kitchenName, area: areaName });
      case 'kitchen_closed':
        return fill(copy.errors.closed, { kitchen: kitchenName });
      case 'below_minimum':
        return copy.errors.belowMinimum;
      case 'item_unavailable':
        return copy.errors.itemUnavailable;
      case 'promotion_refused':
        return copy.errors.offerRefused;
      case 'invalid_phone':
        return copy.errors.phone;
      case 'rate_limited':
        return copy.errors.rateLimited;
      case 'payment_unavailable':
        return copy.errors.paymentUnavailable;
      default:
        return copy.errors.generic;
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !kitchen) return;

    const errors = validate();
    setFieldErrors(errors);
    const firstInvalid = (['area', 'address', 'name', 'phone'] as const).find(
      (field) => errors[field],
    );
    if (firstInvalid) {
      document.getElementById(ids[firstInvalid])?.focus();
      return;
    }

    if (!quote || !mobile || blocker) return;
    if (quote.promotion && !quote.promotion.applied) {
      setSubmitError(copy.errors.offerRefused);
      return;
    }

    const order: OrderRequest = {
      kitchen: kitchen.slug,
      area: areaId,
      lines: bag.lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
      promoCode: offerCode || undefined,
      customer: { name: name.trim(), phone: mobile },
      address: address.trim(),
      note: note.trim() || undefined,
      paymentMethod: method,
      locale,
      expectedTotal: quote.breakdown.total,
    };

    // The same order sent twice (a double click, a retry) carries the same key, so the
    // server creates it once. A changed order gets a new key.
    const signature = JSON.stringify(order);
    if (idempotency.current?.signature !== signature) {
      idempotency.current = { signature, key: newIdempotencyKey() };
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await api.placeOrder(order, idempotency.current.key);
      saveCustomer({ name: order.customer.name, phone: mobile, address: order.address });
      onPlaced(created);
    } catch (error) {
      setSubmitError(describeFailure(error));
      setSubmitting(false);
    }
  };

  /** A field's error goes as soon as the visitor starts correcting that field. */
  const clearError = (fieldName: FieldName) =>
    setFieldErrors((errors) => {
      if (!errors[fieldName]) return errors;
      const rest = { ...errors };
      delete rest[fieldName];
      return rest;
    });

  const pickSaved = (choice: AddressDto) => {
    setAreaId(choice.area.id);
    setAddress(choice.line);
    rememberArea(choice.area.id);
    clearError('area');
    clearError('address');
  };

  const applyOffer = () => {
    setOfferCode(offerInput.trim().toUpperCase());
    setSubmitError(null);
  };

  const field = (fieldName: FieldName) => ({
    'aria-invalid': fieldErrors[fieldName] ? true : undefined,
    'aria-describedby': fieldErrors[fieldName] ? `${ids[fieldName]}-error` : undefined,
  });

  const errorFor = (fieldName: FieldName) =>
    fieldErrors[fieldName] ? (
      <p id={`${ids[fieldName]}-error`} className="field-error">
        {fieldErrors[fieldName]}
      </p>
    ) : null;

  const groupHeading = 'display text-[clamp(1.5rem,2.6vw,2rem)]';

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_25rem]"
    >
      <div className="max-w-[38rem]">
        <h1 className="display text-section">{copy.title}</h1>

        <p className="mt-5 text-base text-soot/80">
          {user ? (
            fill(copy.signedInAs, { name: user.name || user.phone })
          ) : (
            <>
              {copy.signInPrompt}{' '}
              <Link
                href={`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/checkout`)}`}
                className="font-semibold text-soot underline underline-offset-4"
              >
                {signInLabel}
              </Link>
            </>
          )}
        </p>

        <fieldset className="mt-10">
          <legend className={groupHeading}>{copy.deliverTo}</legend>

          {addresses.length > 0 ? (
            <div className="mt-5">
              <p className="field-label">{copy.savedAddresses}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {addresses.map((choice) => {
                  const chosen = choice.area.id === areaId && choice.line === address;
                  return (
                    <li key={choice.id}>
                      <button
                        type="button"
                        aria-pressed={chosen}
                        onClick={() => pickSaved(choice)}
                        className={`rounded-2xl border-2 border-soot px-4 py-2 text-left text-base transition-colors ${
                          chosen ? 'bg-soot text-ash' : 'hover:bg-ash-deep'
                        }`}
                      >
                        <span className="block font-semibold">{choice.label}</span>
                        <span className="block text-sm opacity-80">
                          {choice.line}, {choice.area.name[locale]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-5">
            <label htmlFor={ids.area} className="field-label">
              {copy.area}
            </label>
            <select
              id={ids.area}
              value={areaId}
              onChange={(event) => {
                setAreaId(event.target.value);
                clearError('area');
                if (event.target.value) rememberArea(event.target.value);
              }}
              className="field-input"
              {...field('area')}
            >
              <option value="" disabled>
                {copy.errors.area}
              </option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name[locale]}
                </option>
              ))}
            </select>
            {errorFor('area')}
          </div>

          <div className="mt-5">
            <label htmlFor={ids.address} className="field-label">
              {copy.address}
            </label>
            <input
              id={ids.address}
              type="text"
              autoComplete="street-address"
              maxLength={200}
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                clearError('address');
              }}
              className="field-input"
              {...field('address')}
            />
            {errorFor('address') ?? <p className="field-hint">{copy.addressHint}</p>}
          </div>
        </fieldset>

        <fieldset className="mt-12">
          <legend className={groupHeading}>{copy.details}</legend>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.name} className="field-label">
                {copy.name}
              </label>
              <input
                id={ids.name}
                type="text"
                autoComplete="name"
                maxLength={60}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearError('name');
                }}
                className="field-input"
                {...field('name')}
              />
              {errorFor('name')}
            </div>

            <div>
              <label htmlFor={ids.phone} className="field-label">
                {copy.phone}
              </label>
              <input
                id={ids.phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                maxLength={24}
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  clearError('phone');
                }}
                className="field-input"
                {...field('phone')}
              />
              {errorFor('phone')}
            </div>
          </div>
          {fieldErrors.phone ? null : <p className="field-hint">{copy.phoneHint}</p>}

          <div className="mt-5">
            <label htmlFor={ids.note} className="field-label">
              {copy.note}
            </label>
            <input
              id={ids.note}
              type="text"
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={copy.notePlaceholder}
              className="field-input"
            />
          </div>
        </fieldset>

        <div className="mt-12">
          <h2 className={groupHeading}>
            <label htmlFor={ids.offer}>{copy.offer}</label>
          </h2>
          <div className="mt-5 flex gap-2">
            <input
              id={ids.offer}
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={24}
              value={offerInput}
              onChange={(event) => setOfferInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                // Enter here applies the code. It must not place the order.
                event.preventDefault();
                applyOffer();
              }}
              className="field-input mt-0 max-w-[16rem] font-mono uppercase"
            />
            <button
              type="button"
              onClick={applyOffer}
              className="btn btn-outline shrink-0"
            >
              {copy.offerApply}
            </button>
          </div>

          <div aria-live="polite">
            {quote?.promotion?.applied ? (
              <p className="mt-3 text-base font-semibold text-leaf">
                {fill(copy.offerApplied, { code: quote.promotion.code })}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setOfferCode('');
                    setOfferInput('');
                  }}
                  className="font-semibold text-soot underline underline-offset-4"
                >
                  {copy.offerRemove}
                </button>
              </p>
            ) : null}
            {quote?.promotion && !quote.promotion.applied ? (
              <p className="field-error">{copy.offerReasons[quote.promotion.reason]}</p>
            ) : null}
          </div>
        </div>

        <fieldset className="mt-12">
          <legend className={groupHeading}>{copy.payment}</legend>
          <div className="mt-5 space-y-3">
            {paymentOptions.map((option) => {
              const chosen = option.method === method;
              return (
                <label
                  key={option.method}
                  className={`flex cursor-pointer items-start gap-4 rounded-[1.25rem] border-2 p-5 transition-colors ${
                    chosen ? 'border-soot bg-paper' : 'border-soot/30 hover:border-soot'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={option.method}
                    checked={chosen}
                    onChange={() => {
                      setMethod(option.method);
                      setSubmitError(null);
                    }}
                    className="mt-1 h-5 w-5 shrink-0 accent-soot"
                  />
                  <span>
                    <span className="block text-lg font-semibold">
                      {copy.methods[option.method]}
                    </span>
                    {chosen ? (
                      <span className="mt-1 block text-base text-soot/75">
                        {total
                          ? fill(
                              isOnline(option.method) ? copy.onlineBody : copy.cashBody,
                              {
                                total,
                              },
                            )
                          : copy.working}
                      </span>
                    ) : null}
                    {option.sandbox ? (
                      <span className="mt-1 block text-sm text-soot/65">
                        {copy.sandboxNote}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        {quote ? (
          <Receipt
            locale={locale}
            title={pricingCopy.receiptTitle}
            kitchen={quote.kitchen.name[locale]}
            items={quote.lines.map((line) => ({
              label: line.name[locale],
              quantity: line.quantity,
              amount: line.total,
            }))}
            charges={receiptCharges(quote.breakdown, pricingCopy.lines)}
            total={{ label: pricingCopy.lines.total, amount: quote.breakdown.total }}
            notes={[
              fill(pricingCopy.arrives, {
                min: formatNumber(quote.window.min, locale),
                max: formatNumber(quote.window.max, locale),
              }),
              pricingCopy.nothingAdded,
            ]}
          />
        ) : (
          <div>
            <div className="bg-paper px-6 py-7 font-mono text-base sm:px-7">
              <p className="font-display text-2xl font-bold [font-stretch:82%]">
                {pricingCopy.receiptTitle}
              </p>
              <p className="mt-1">{kitchenName}</p>
              <ul className="mt-5 space-y-2 border-t-2 border-dashed border-soot/40 pt-5">
                {bag.lines.map((line) => (
                  <li key={line.itemId} className="flex justify-between gap-4">
                    <span>
                      {formatNumber(line.quantity, locale)} × {line.name[locale]}
                    </span>
                    <span className="tabular-nums">
                      {formatTaka(line.unitPrice * line.quantity, locale)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t-2 border-dashed border-soot/40 pt-5 text-sm text-soot/75">
                {areaId ? (quoteProblem ?? copy.working) : copy.errors.area}
              </p>
            </div>
            <div aria-hidden="true" className="receipt-edge" />
          </div>
        )}

        <div aria-live="assertive">
          {quote && quoteProblem ? (
            <p className="field-error mt-4">{quoteProblem}</p>
          ) : null}
          {blocker ? <p className="field-error mt-4 text-base">{blocker}</p> : null}
          {submitError ? (
            <p className="field-error mt-4 text-base">{submitError}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!quote || submitting || blocker !== null}
          className="btn btn-primary mt-5 w-full py-4 text-lg"
        >
          {submitting
            ? copy.placing
            : total
              ? fill(isOnline(method) ? copy.payWithTotal : copy.placeWithTotal, {
                  total,
                })
              : copy.place}
        </button>

        {kitchen ? (
          <Link
            href={`/${locale}/kitchens/${kitchen.slug}`}
            className="mt-4 inline-block text-base font-semibold underline underline-offset-4"
          >
            {copy.changeItems}
          </Link>
        ) : null}

        {/*
          On a wide screen the suggestions sit beside the menu. A phone has no room for
          them there, so this is where a phone shows them.
        */}
        {kitchen ? (
          <GoesWith
            locale={locale}
            kitchen={kitchen}
            heading={suggestCopy.heading}
            addLabel={suggestCopy.add}
            addItemLabel={suggestCopy.addItem}
            className="mt-9 lg:hidden"
          />
        ) : null}
      </div>
    </form>
  );
}
