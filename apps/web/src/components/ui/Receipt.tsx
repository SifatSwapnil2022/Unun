'use client';

import { roundToTaka, type Paisa } from '@unun/core';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import type { Locale } from '@/i18n/config';
import { formatNumber, formatTaka } from '@/lib/format';
import type { ReceiptCharge } from '@/lib/receipt';

export type ReceiptItem = { label: string; quantity: number; amount: Paisa };

type ReceiptProps = {
  locale: Locale;
  title: string;
  kitchen: string;
  items: ReceiptItem[];
  charges: ReceiptCharge[];
  total: ReceiptCharge;
  notes?: string[];
  /** Count the amounts up from zero the first time the receipt scrolls into view. */
  countUp?: boolean;
  className?: string;
};

function Amount({ value, locale, run }: { value: Paisa; locale: Locale; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!run || !node) return;

    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = formatTaka(roundToTaka(latest), locale);
      },
    });
    return () => controls.stop();
  }, [run, value, locale]);

  // The final amount is rendered on the server, so the receipt is correct without JavaScript.
  return (
    <span ref={ref} className="tabular-nums">
      {formatTaka(value, locale)}
    </span>
  );
}

/** The paper receipt. Mono type is kept for paper: this, and the order tickets. */
export function Receipt({
  locale,
  title,
  kitchen,
  items,
  charges,
  total,
  notes = [],
  countUp = false,
  className = '',
}: ReceiptProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reducedMotion = useReducedMotion();
  const run = countUp && inView && !reducedMotion;

  return (
    <div ref={ref} className={`w-full font-mono text-base text-soot ${className}`}>
      <div className="bg-paper px-6 pt-7 pb-6 sm:px-7 sm:pt-8">
        <p className="font-display text-2xl font-bold [font-stretch:82%]">{title}</p>
        <p className="mt-1">{kitchen}</p>

        <ul className="mt-5 space-y-2 border-t-2 border-dashed border-soot/40 pt-5">
          {items.map((item) => (
            <li key={item.label} className="flex justify-between gap-4">
              <span>
                {formatNumber(item.quantity, locale)} × {item.label}
              </span>
              <span className="tabular-nums">{formatTaka(item.amount, locale)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-2 border-t-2 border-dashed border-soot/40 pt-5">
          {charges.map((charge) => (
            <div key={charge.label} className="flex justify-between gap-4">
              <dt>{charge.label}</dt>
              <dd>
                <Amount value={charge.amount} locale={locale} run={run} />
              </dd>
            </div>
          ))}
        </dl>

        <dl className="mt-5 border-t-2 border-dashed border-soot/40 pt-5">
          <div className="flex items-baseline justify-between gap-4 text-xl font-medium">
            <dt>{total.label}</dt>
            <dd className="text-2xl">
              <Amount value={total.amount} locale={locale} run={run} />
            </dd>
          </div>
        </dl>

        {notes.length > 0 ? (
          <ul className="mt-5 space-y-1 border-t-2 border-dashed border-soot/40 pt-5 text-sm text-soot/75">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div aria-hidden="true" className="receipt-edge" />
    </div>
  );
}
