'use client';

import type { PaymentDto, SandboxOutcome } from '@unun/core/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { ApiRequestError, api } from '@/lib/api';
import { formatClock, formatTaka } from '@/lib/format';

type SandboxPayProps = {
  locale: Locale;
  initial: PaymentDto;
  copy: Dictionary['pay'];
  methods: Dictionary['payment']['methods'];
};

/**
 * The test gateway's page. It stands where a real gateway's page would: the customer
 * arrives with a payment to finish and leaves with it approved, declined or cancelled.
 * It is plainly a test page and asks for nothing a real gateway would ask for.
 */
export function SandboxPay({ locale, initial, copy, methods }: SandboxPayProps) {
  const router = useRouter();
  const [payment, setPayment] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const orderHref = `/${locale}/orders/${payment.order.token}`;

  const finish = async (outcome: SandboxOutcome) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const settled = await api.settleSandbox(payment.token, outcome);
      // An approved payment has nothing more to show here. A cancelled one goes back too.
      if (settled.status === 'paid' || outcome === 'cancel') router.replace(orderHref);
      else {
        setPayment(settled);
        setBusy(false);
      }
    } catch (error) {
      // "Closed" means someone finished it elsewhere: show how it really ended.
      if (error instanceof ApiRequestError && error.code === 'payment_closed') {
        setPayment(await api.payment(payment.token).catch(() => payment));
      } else {
        setFailed(true);
      }
      setBusy(false);
    }
  };

  const tryAgain = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const next = await api.payOrder(payment.order.token);
      if (next.url) window.location.assign(next.url);
      else {
        setPayment(await api.payment(next.token));
        router.replace(`/${locale}/pay/${next.token}`);
        setBusy(false);
      }
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const facts = [
    { term: copy.amount, value: formatTaka(payment.amount, locale) },
    { term: copy.method, value: methods[payment.method] },
  ];

  return (
    <div className="mx-auto max-w-[34rem]">
      <div className="bg-paper px-6 pt-8 pb-7 sm:px-9 sm:pt-10">
        <p className="w-fit rounded-full bg-turmeric px-3 py-0.5 text-sm font-semibold">
          {copy.title}
        </p>

        <div aria-live="polite">
          {payment.status === 'pending' ? (
            <>
              <h1 className="display mt-5 text-[clamp(2.5rem,8vw,4rem)] tabular-nums">
                {formatTaka(payment.amount, locale)}
              </h1>
              <p className="mt-2 text-lg">
                {fill(copy.order, {
                  id: payment.order.publicId,
                  kitchen: payment.order.kitchen[locale],
                })}
              </p>
            </>
          ) : (
            <>
              <h1 className="display mt-5 text-[clamp(2rem,6vw,3rem)]">
                {copy.done[payment.status]}
              </h1>
              <p className="mt-3 text-lg">{copy.doneBody[payment.status]}</p>
            </>
          )}
        </div>

        <dl className="mt-7 space-y-2 border-t-2 border-dashed border-soot/40 pt-5 font-mono text-base">
          {facts.map((fact) => (
            <div key={fact.term} className="flex justify-between gap-4">
              <dt>{fact.term}</dt>
              <dd className="tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {payment.status === 'pending' ? (
          <>
            <p className="mt-7 border-t-2 border-dashed border-soot/40 pt-5 text-base text-soot/80">
              {copy.body}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish('approve')}
                className="btn btn-primary py-4 text-lg"
              >
                {busy ? copy.working : copy.approve}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish('decline')}
                className="btn btn-outline"
              >
                {copy.decline}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish('cancel')}
                className="py-2 text-base font-semibold underline underline-offset-4"
              >
                {copy.cancel}
              </button>
            </div>

            <p className="mt-5 text-sm text-soot/70">
              {fill(copy.expires, { time: formatClock(payment.expiresAt, locale) })}
            </p>
          </>
        ) : (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {payment.status === 'failed' || payment.status === 'cancelled' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void tryAgain()}
                className="btn btn-primary"
              >
                {busy ? copy.working : copy.tryAgain}
              </button>
            ) : null}
            <Link href={orderHref} className="btn btn-outline">
              {copy.toOrder}
            </Link>
          </div>
        )}

        {failed ? (
          <p role="alert" className="field-error mt-4 text-base">
            {copy.error}
          </p>
        ) : null}
      </div>
      <div aria-hidden="true" className="receipt-edge" />
    </div>
  );
}
