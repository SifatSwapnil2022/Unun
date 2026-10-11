'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';

type LocaleSwitchProps = {
  locale: Locale;
  label: string;
  accessibleLabel: string;
};

/** Links to the same page in the other language. */
export function LocaleSwitch({ locale, label, accessibleLabel }: LocaleSwitchProps) {
  const pathname = usePathname();
  const other: Locale = locale === 'en' ? 'bn' : 'en';
  const rest = pathname.split('/').slice(2).join('/');

  return (
    <Link
      href={`/${other}${rest ? `/${rest}` : ''}`}
      lang={other}
      hrefLang={other}
      aria-label={accessibleLabel}
      className="header-pill"
    >
      {label}
    </Link>
  );
}
