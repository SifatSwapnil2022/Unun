'use client';

import { allergensToAvoid, type Localized } from '@unun/core';
import type { MenuItemDto } from '@unun/core/contracts';
import { useEffect, useState } from 'react';
import { useBag } from '@/components/bag/useBag';
import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';
import { formatTaka } from '@/lib/format';
import { useAvoiding } from '@/lib/hooks/useAvoiding';

type GoesWithProps = {
  locale: Locale;
  kitchen: { slug: string; name: Localized };
  heading: string;
  /** "Add" and "Add {item} to bag". */
  addLabel: string;
  addItemLabel: string;
  className?: string;
};

/**
 * Dishes that go with what is in the bag: found in past orders when the learning
 * service is running, the kitchen's best sellers when it is not. It shows nothing
 * until there is something to suggest, and never a dish the customer is avoiding.
 */
export function GoesWith({
  locale,
  kitchen,
  heading,
  addLabel,
  addItemLabel,
  className = '',
}: GoesWithProps) {
  const { bag, add } = useBag();
  const { avoiding } = useAvoiding();
  const [found, setFound] = useState<{ key: string; items: MenuItemDto[] }>({
    key: '',
    items: [],
  });

  const mine = bag.kitchen?.slug === kitchen.slug;
  // Which dishes are in the bag, not how many of each: a second kacchi changes nothing.
  const key = mine
    ? bag.lines
        .map((line) => line.itemId)
        .sort((a, b) => a - b)
        .join(',')
    : '';

  useEffect(() => {
    if (key === '') return;

    const controller = new AbortController();
    api
      .pairings(kitchen.slug, key.split(',').map(Number), controller.signal)
      .then((answer) => setFound({ key, items: answer.items }))
      // A suggestion is an extra. If it cannot be fetched, the bag works without it.
      .catch(() => {});
    return () => controller.abort();
  }, [key, kitchen.slug]);

  // Suggestions fetched for another bag are not shown beside this one.
  const items = (found.key === key ? found.items : []).filter(
    (item) => allergensToAvoid(item.allergens, avoiding).length === 0,
  );
  if (items.length === 0) return null;

  return (
    <section aria-label={heading} className={className}>
      <h3 className="text-base font-semibold">{heading}</h3>
      <ul className="mt-2 border-t border-soot/25">
        {items.map((item) => {
          const name = item.name[locale];
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 border-b border-soot/25 py-3"
            >
              <p className="min-w-0">
                <span className="block font-semibold">{name}</span>
                <span className="tabular-nums text-soot/75">
                  {formatTaka(item.price, locale)}
                </span>
              </p>
              <button
                type="button"
                aria-label={fill(addItemLabel, { item: name })}
                onClick={() =>
                  add(kitchen, {
                    itemId: item.id,
                    name: item.name,
                    unitPrice: item.price,
                  })
                }
                className="btn btn-outline shrink-0 px-4 py-1.5"
              >
                {addLabel}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
