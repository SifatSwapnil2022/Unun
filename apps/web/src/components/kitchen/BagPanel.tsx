'use client';

import { priceOrder, type DeliveryWindow, type Localized, type Paisa } from '@unun/core';
import Link from 'next/link';
import { Stepper } from '@/components/bag/Stepper';
import { useBag } from '@/components/bag/useBag';
import { GoesWith } from '@/components/kitchen/GoesWith';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { itemCount } from '@/lib/bag';
import { formatNumber, formatTaka, plural } from '@/lib/format';
import { receiptCharges } from '@/lib/receipt';

type BagPanelProps = {
  locale: Locale;
  kitchen: { slug: string; name: Localized; minOrder: Paisa };
  deliveryFee: Paisa;
  window: DeliveryWindow;
  pricing: { serviceFee: Paisa; vatRate: number };
  copy: Dictionary['bag'];
  kitchenCopy: Dictionary['kitchen'];
  pricingCopy: Dictionary['pricing'];
};

const paperHeading = 'font-display text-2xl font-bold [font-stretch:82%]';
const paperRule = 'border-t-2 border-dashed border-soot/40';

/**
 * The bag beside the menu. It shows the full price from the first item, worked out by
 * the same pricing function the checkout and the API use. On small screens it becomes
 * a bar at the bottom of the page.
 */
export function BagPanel({
  locale,
  kitchen,
  deliveryFee,
  window,
  pricing,
  copy,
  kitchenCopy,
  pricingCopy,
}: BagPanelProps) {
  const { bag, change } = useBag();
  const count = itemCount(bag);
  const checkoutHref = `/${locale}/checkout`;

  if (count === 0) {
    return (
      <aside
        aria-label={copy.heading}
        className="sticky top-6 hidden self-start lg:block"
      >
        <div className="bg-paper px-6 py-7 font-mono text-base">
          <h2 className={paperHeading}>{copy.heading}</h2>
          <p className="mt-4">{copy.empty}</p>
          <p className="mt-2 text-sm text-soot/75">{copy.emptyHint}</p>
        </div>
        <div aria-hidden="true" className="receipt-edge" />
      </aside>
    );
  }

  // The bag belongs to another kitchen: point back to it instead of pricing it here.
  if (bag.kitchen && bag.kitchen.slug !== kitchen.slug) {
    const other = bag.kitchen.name[locale];
    return (
      <>
        <aside
          aria-label={copy.heading}
          className="sticky top-6 hidden self-start lg:block"
        >
          <div className="bg-paper px-6 py-7 font-mono text-base">
            <h2 className={paperHeading}>{copy.heading}</h2>
            <p className="mt-4">{fill(copy.otherKitchen, { kitchen: other })}</p>
            <Link
              href={`/${locale}/kitchens/${bag.kitchen.slug}`}
              className="mt-3 inline-block font-sans font-semibold underline underline-offset-4"
            >
              {fill(copy.openKitchen, { kitchen: other })}
            </Link>
          </div>
          <div aria-hidden="true" className="receipt-edge" />
          <Link href={checkoutHref} className="btn btn-primary mt-5 w-full">
            {copy.checkout}
          </Link>
        </aside>
        <MobileBar
          href={checkoutHref}
          label={copy.viewBag}
          detail={fill(plural(count, copy.items), { count: formatNumber(count, locale) })}
        />
      </>
    );
  }

  const breakdown = priceOrder(bag.lines, { deliveryFee, ...pricing });
  const shortBy = kitchen.minOrder - breakdown.items;
  const total = formatTaka(breakdown.total, locale);

  return (
    <>
      <aside
        aria-label={copy.heading}
        className="sticky top-6 hidden self-start lg:block"
      >
        <div className="bg-paper px-6 pt-7 pb-6 font-mono text-base">
          <h2 className={paperHeading}>{copy.heading}</h2>
          <p className="mt-1">{fill(copy.from, { kitchen: kitchen.name[locale] })}</p>

          <ul className={`mt-5 space-y-4 pt-5 ${paperRule}`}>
            {bag.lines.map((line) => {
              const name = line.name[locale];
              return (
                <li key={line.itemId}>
                  <p className="flex justify-between gap-4">
                    <span>{name}</span>
                    <span className="tabular-nums">
                      {formatTaka(line.unitPrice * line.quantity, locale)}
                    </span>
                  </p>
                  <div className="mt-2">
                    <Stepper
                      size="small"
                      value={formatNumber(line.quantity, locale)}
                      quantity={line.quantity}
                      onChange={(next) => change(line.itemId, next)}
                      decreaseLabel={fill(kitchenCopy.decrease, { item: name })}
                      increaseLabel={fill(kitchenCopy.increase, { item: name })}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className={`mt-5 space-y-2 pt-5 ${paperRule}`}>
            {receiptCharges(breakdown, pricingCopy.lines).map((charge) => (
              <div key={charge.label} className="flex justify-between gap-4">
                <dt>{charge.label}</dt>
                <dd className="tabular-nums">{formatTaka(charge.amount, locale)}</dd>
              </div>
            ))}
          </dl>

          <dl className={`mt-5 pt-5 ${paperRule}`}>
            <div className="flex items-baseline justify-between gap-4 text-xl font-medium">
              <dt>{pricingCopy.lines.total}</dt>
              <dd className="text-2xl tabular-nums" aria-live="polite">
                {total}
              </dd>
            </div>
          </dl>

          <p className={`mt-5 pt-5 text-sm text-soot/75 ${paperRule}`}>
            {fill(pricingCopy.arrives, {
              min: formatNumber(window.min, locale),
              max: formatNumber(window.max, locale),
            })}
          </p>
        </div>
        <div aria-hidden="true" className="receipt-edge" />

        {shortBy > 0 ? (
          <p className="mt-4 text-base font-semibold text-clay">
            {fill(copy.belowMinimum, {
              amount: formatTaka(shortBy, locale),
              minimum: formatTaka(kitchen.minOrder, locale),
            })}
          </p>
        ) : null}

        <Link href={checkoutHref} className="btn btn-primary mt-5 w-full">
          {copy.checkout}
        </Link>
        <p className="mt-3 text-sm text-soot/70">{copy.fullPrice}</p>

        <GoesWith
          locale={locale}
          kitchen={kitchen}
          heading={copy.goesWith}
          addLabel={kitchenCopy.add}
          addItemLabel={kitchenCopy.addItem}
          className="mt-8"
        />
      </aside>

      <MobileBar
        href={checkoutHref}
        label={copy.viewBag}
        detail={fill(plural(count, copy.items), { count: formatNumber(count, locale) })}
        total={total}
      />
    </>
  );
}

function MobileBar({
  href,
  label,
  detail,
  total,
}: {
  href: string;
  label: string;
  detail: string;
  total?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[var(--tabbar)] z-30 bg-soot p-3 lg:hidden">
      <Link href={href} className="btn btn-primary w-full justify-between">
        <span>
          {label}, {detail}
        </span>
        {total ? <span className="tabular-nums">{total}</span> : null}
      </Link>
    </div>
  );
}
