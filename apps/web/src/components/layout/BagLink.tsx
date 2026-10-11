'use client';

import Link from 'next/link';
import { useBag } from '@/components/bag/useBag';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { itemCount } from '@/lib/bag';
import { formatNumber, plural } from '@/lib/format';

type BagLinkProps = {
  locale: Locale;
  copy: Dictionary['nav'];
};

export function BagLink({ locale, copy }: BagLinkProps) {
  const { bag } = useBag();
  const count = itemCount(bag);
  const formatted = formatNumber(count, locale);

  return (
    <Link
      href={`/${locale}/checkout`}
      aria-label={
        count > 0 ? fill(plural(count, copy.bagWith), { count: formatted }) : copy.bag
      }
      className="header-pill flex items-center gap-2"
    >
      {copy.bag}
      {count > 0 ? (
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-ember px-1.5 text-sm font-semibold text-soot tabular-nums">
          {formatted}
        </span>
      ) : null}
    </Link>
  );
}
