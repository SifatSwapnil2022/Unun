'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBag } from '@/components/bag/useBag';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { itemCount } from '@/lib/bag';
import { formatNumber, plural } from '@/lib/format';

export type MobileTab = {
  key: 'home' | 'kitchens' | 'bag' | 'account';
  href: string;
  label: string;
};

type MobileTabsNavProps = {
  locale: Locale;
  label: string;
  items: MobileTab[];
  bagCopy: Dictionary['nav'];
};

/** Which tab the page at `pathname` belongs to, if any. */
function currentTab(pathname: string, locale: Locale): MobileTab['key'] | null {
  const [section = ''] = pathname.replace(`/${locale}`, '').split('/').filter(Boolean);
  if (section === '') return 'home';
  if (section === 'kitchens') return 'kitchens';
  if (section === 'checkout' || section === 'pay') return 'bag';
  if (['account', 'sign-in', 'partner', 'rider', 'admin', 'orders'].includes(section)) {
    return 'account';
  }
  return null;
}

export function MobileTabsNav({ locale, label, items, bagCopy }: MobileTabsNavProps) {
  const pathname = usePathname();
  const { bag } = useBag();
  const count = itemCount(bag);
  const current = currentTab(pathname, locale);

  return (
    <nav aria-label={label} className="mobile-tabs md:hidden">
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const isCurrent = item.key === current;
          const withCount = item.key === 'bag' && count > 0;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={
                  withCount
                    ? fill(plural(count, bagCopy.bagWith), {
                        count: formatNumber(count, locale),
                      })
                    : undefined
                }
                className="mobile-tab"
              >
                <span className="truncate">{item.label}</span>
                {withCount ? (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-ember px-1 text-xs font-semibold text-soot tabular-nums">
                    {formatNumber(count, locale)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
