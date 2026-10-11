import { priceOrder } from '@unun/core';
import type { KitchenDetail } from '@unun/core/contracts';
import { Receipt } from '@/components/ui/Receipt';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { formatNumber } from '@/lib/format';
import { receiptCharges } from '@/lib/receipt';

type PricingProps = {
  locale: Locale;
  copy: Dictionary['pricing'];
  /** A real kitchen. Its most-ordered dishes make up the example order. */
  kitchen: KitchenDetail | null;
};

export function Pricing({ locale, copy, kitchen }: PricingProps) {
  const items = (kitchen?.sections ?? [])
    .flatMap((section) => section.items)
    .filter((item) => item.popular && item.available);

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-6 bg-turmeric text-soot"
    >
      <div className="page-column grid gap-x-16 gap-y-12 py-[clamp(3.5rem,9vw,6.5rem)] lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-center">
        <div>
          <h2 id="pricing-heading" className="display text-section max-w-[14ch]">
            {copy.heading}
          </h2>
          <p className="mt-6 max-w-[40ch] text-xl">{copy.body}</p>
        </div>

        {kitchen && items.length > 0 ? (
          <PricingReceipt locale={locale} copy={copy} kitchen={kitchen} items={items} />
        ) : null}
      </div>
    </section>
  );
}

function PricingReceipt({
  locale,
  copy,
  kitchen,
  items,
}: {
  locale: Locale;
  copy: Dictionary['pricing'];
  kitchen: KitchenDetail;
  items: KitchenDetail['sections'][number]['items'];
}) {
  // Priced by the same function the checkout and the API use.
  const breakdown = priceOrder(
    items.map((item) => ({ unitPrice: item.price, quantity: 1 })),
    {
      deliveryFee: kitchen.delivery.fee,
      serviceFee: kitchen.pricing.serviceFee,
      vatRate: kitchen.pricing.vatRate,
    },
  );
  const { min, max } = kitchen.delivery.window;

  return (
    <Receipt
      locale={locale}
      countUp
      className="max-w-[25rem]"
      title={copy.receiptTitle}
      kitchen={kitchen.name[locale]}
      items={items.map((item) => ({
        label: item.name[locale],
        quantity: 1,
        amount: item.price,
      }))}
      charges={receiptCharges(breakdown, copy.lines)}
      total={{ label: copy.lines.total, amount: breakdown.total }}
      notes={[
        fill(copy.arrives, {
          min: formatNumber(min, locale),
          max: formatNumber(max, locale),
        }),
        copy.nothingAdded,
      ]}
    />
  );
}
