'use client';

import { ORDER_STEPS, firstName, isFinal, isSystemReason } from '@unun/core';
import type { OrderDto } from '@unun/core/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DeliveryMapLazy } from '@/components/map/DeliveryMapLazy';
import { OrderFeedback } from '@/components/order/OrderFeedback';
import { Receipt } from '@/components/ui/Receipt';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';
import { formatClock, formatNumber, formatTaka, plural } from '@/lib/format';
import { receiptCharges } from '@/lib/receipt';

type OrderTrackerProps = {
  locale: Locale;
  initial: OrderDto;
  copy: Dictionary['order'];
  pricingCopy: Dictionary['pricing'];
  methods: Dictionary['payment']['methods'];
  ratingCopy: Dictionary['rating'];
};

const POLL_MS = 2000;
/** A finished order is only checked again while a problem report awaits its answer. */
const SLOW_POLL_MS = 20_000;
/** After this many failed checks in a row the page says updates have stopped. */
const FAILURES_BEFORE_WARNING = 3;

export function OrderTracker({
  locale,
  initial,
  copy,
  pricingCopy,
  methods,
  ratingCopy,
}: OrderTrackerProps) {
  const [order, setOrder] = useState(initial);
  const [failures, setFailures] = useState(0);
  const [paying, setPaying] = useState(false);
  const finished = isFinal(order.status);
  const awaitingAnswer = order.issues.some((issue) => issue.status === 'open');

  useEffect(() => {
    if (finished && !awaitingAnswer) return;

    let cancelled = false;
    const timer = window.setInterval(
      () => {
        api
          .order(order.token)
          .then((latest) => {
            if (cancelled) return;
            setOrder(latest);
            setFailures(0);
          })
          .catch(() => {
            if (!cancelled) setFailures((count) => count + 1);
          });
      },
      finished ? SLOW_POLL_MS : POLL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [finished, awaitingAnswer, order.token]);

  const { payment, map } = order;
  const reachedAt = new Map(order.events.map((event) => [event.status, event.at]));
  const total = formatTaka(order.breakdown.total, locale);
  const deliveredAt = reachedAt.get('delivered');
  const cancelled = order.status === 'cancelled';
  const awaiting = payment.state === 'awaiting';

  const ARRIVAL_LINES = {
    early: copy.arrivedEarly,
    on_time: copy.arrivedInside,
    late: copy.arrivedLate,
  };

  const headline = awaiting ? copy.awaitingTitle : copy.status[order.status];

  const summary = (() => {
    if (awaiting && payment.payBy) {
      return fill(copy.awaitingBody, { time: formatClock(payment.payBy, locale) });
    }
    if (cancelled) {
      if (!order.cancelReason) return copy.cancelledNoReason;
      return fill(copy.cancelledReason, {
        reason: isSystemReason(order.cancelReason)
          ? copy.systemReasons[order.cancelReason]
          : order.cancelReason,
      });
    }
    if (deliveredAt && order.arrival) {
      return fill(ARRIVAL_LINES[order.arrival], {
        time: formatClock(deliveredAt, locale),
      });
    }
    return fill(copy.promised, {
      from: formatClock(order.promisedFrom, locale),
      to: formatClock(order.promisedTo, locale),
    });
  })();

  const riderLine = (() => {
    if (!order.rider || cancelled) return null;
    const template =
      order.status === 'delivered'
        ? copy.deliveredBy
        : order.status === 'picked_up'
          ? copy.riderComing
          : copy.riderWaiting;
    return fill(template, { name: order.rider.name });
  })();

  const etaLine =
    map.etaMinutes === null
      ? null
      : fill(plural(map.etaMinutes, copy.eta), {
          count: formatNumber(map.etaMinutes, locale),
        });

  /** What the customer owes, has paid or has had back, in one sentence. */
  const payLine = (() => {
    switch (payment.state) {
      case 'awaiting':
        return null;
      case 'not_charged':
        return copy.nothingToPay;
      case 'cash_due':
        return fill(copy.payCash, { total });
      case 'refunded':
        return fill(copy.refundedFull, { amount: formatTaka(payment.refunded, locale) });
      case 'part_refunded':
        return fill(copy.refundedPart, {
          amount: formatTaka(payment.refunded, locale),
          total,
        });
      case 'paid':
        return payment.method === 'cash'
          ? fill(copy.paidCash, { total })
          : fill(copy.paidOnline, { method: methods[payment.method], total });
    }
  })();

  /** To the open payment, or to a fresh one when the last attempt did not go through. */
  const pay = async () => {
    if (paying) return;
    setPaying(true);
    try {
      const open = payment.open ?? (await api.payOrder(order.token));
      window.location.assign(open.url ?? `/${locale}/pay/${open.token}`);
    } catch {
      setPaying(false);
    }
  };

  const showMap = !awaiting && !finished;
  const riderName = order.rider ? firstName(order.rider.name) : copy.map.rider;

  return (
    <>
      <div className="bg-soot text-ash">
        <div className="page-column pt-[clamp(2.5rem,6vw,4rem)] pb-[clamp(2.5rem,6vw,4.5rem)]">
          <p className="text-base text-ash/70">
            {fill(copy.title, { id: order.publicId })}, {order.kitchen.name[locale]}
          </p>

          <div aria-live="polite">
            <h1 className="display mt-4 max-w-[17ch] text-[clamp(2.5rem,6.5vw,5rem)]">
              {headline}
            </h1>
            <p className="mt-5 max-w-[46ch] text-xl text-ash/90">{summary}</p>
            {riderLine ? (
              <p className="mt-2 max-w-[46ch] text-xl text-ash/90">{riderLine}</p>
            ) : null}
            {etaLine ? (
              <p className="display mt-4 text-[clamp(1.5rem,3vw,2rem)] text-turmeric tabular-nums">
                {etaLine}
              </p>
            ) : null}
          </div>

          {awaiting ? (
            <button
              type="button"
              disabled={paying}
              onClick={() => void pay()}
              className="btn btn-primary mt-8 px-8 py-4 text-lg"
            >
              {fill(copy.payNow, { total })}
            </button>
          ) : (
            <ol
              aria-label={copy.progressLabel}
              className="mt-10 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6"
            >
              {ORDER_STEPS.map((status) => {
                const at = reachedAt.get(status);
                const isCurrent = status === order.status;
                return (
                  <li
                    key={status}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`border-t-[3px] pt-3 ${
                      at ? 'border-turmeric' : 'border-ash/25 text-ash/55'
                    }`}
                  >
                    <p className={`text-base ${isCurrent ? 'font-semibold' : ''}`}>
                      {copy.steps[status]}
                    </p>
                    <p className="mt-0.5 text-sm tabular-nums">
                      {at ? formatClock(at, locale) : ' '}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}

          {failures >= FAILURES_BEFORE_WARNING ? (
            <p role="alert" className="mt-6 text-base font-semibold text-turmeric">
              {copy.connectionLost}
            </p>
          ) : null}
        </div>
      </div>

      <div className="bg-ash">
        <div className="page-column grid gap-x-16 gap-y-12 py-[clamp(3rem,8vw,5.5rem)] lg:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="min-w-0">
            {showMap ? (
              <figure className="mb-10">
                <DeliveryMapLazy
                  label={copy.map.label}
                  kitchen={{ position: map.kitchen, label: order.kitchen.name[locale] }}
                  destination={{ position: map.destination, label: copy.map.you }}
                  rider={
                    map.rider ? { position: map.rider.position, label: riderName } : null
                  }
                />
                <figcaption className="mt-3 max-w-[60ch] text-sm text-soot/70">
                  {map.rider ? `${copy.map[map.rider.source]} ` : ''}
                  {copy.map.line}
                </figcaption>
              </figure>
            ) : null}

            <div className="max-w-[36rem]">
              {payLine ? (
                <p className="display text-[clamp(1.6rem,3vw,2.2rem)]">{payLine}</p>
              ) : null}

              <dl className={`space-y-6 text-lg ${payLine ? 'mt-9' : ''}`}>
                <div>
                  <dt className="text-base text-soot/70">{copy.deliverTo}</dt>
                  <dd className="mt-1">
                    {order.customer.name}, {order.customer.phone}
                  </dd>
                  <dd>
                    {order.deliverTo.address}, {order.deliverTo.area[locale]}
                  </dd>
                </div>
                <div>
                  <dt className="text-base text-soot/70">{copy.from}</dt>
                  <dd className="mt-1">
                    {order.kitchen.name[locale]}, {order.kitchen.area[locale]}
                  </dd>
                </div>
                {order.deliverTo.note ? (
                  <div>
                    <dt className="text-base text-soot/70">{copy.note}</dt>
                    <dd className="mt-1">{order.deliverTo.note}</dd>
                  </div>
                ) : null}
              </dl>

              {order.handledBy === 'people' && !finished && !awaiting ? (
                <p className="mt-9 max-w-[46ch] border-t border-soot/25 pt-5 text-base text-soot/70">
                  {copy.byPeople}
                </p>
              ) : null}
              {order.handledBy === 'autopilot' && order.demoSpeed > 1 && !awaiting ? (
                <p className="mt-9 max-w-[46ch] border-t border-soot/25 pt-5 text-base text-soot/70">
                  {fill(copy.demo, { speed: formatNumber(order.demoSpeed, locale) })}
                </p>
              ) : null}

              <OrderFeedback
                locale={locale}
                order={order}
                copy={copy}
                ratingCopy={ratingCopy}
                onChange={setOrder}
              />

              {finished ? (
                <Link
                  href={`/${locale}/kitchens/${order.kitchen.slug}`}
                  className="btn btn-dark mt-10"
                >
                  {fill(copy.orderAgain, { kitchen: order.kitchen.name[locale] })}
                </Link>
              ) : null}
            </div>
          </div>

          <Receipt
            locale={locale}
            title={fill(copy.title, { id: order.publicId })}
            kitchen={order.kitchen.name[locale]}
            items={order.lines.map((line) => ({
              label: line.name[locale],
              quantity: line.quantity,
              amount: line.total,
            }))}
            charges={receiptCharges(order.breakdown, pricingCopy.lines)}
            total={{ label: pricingCopy.lines.total, amount: order.breakdown.total }}
          />
        </div>
      </div>
    </>
  );
}
