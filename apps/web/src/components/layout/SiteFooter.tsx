import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';

type SiteFooterProps = {
  locale: Locale;
  copy: Dictionary['footer'];
  nav: Dictionary['nav'];
};

const SOURCE_URL = 'https://github.com/SifatSwapnil2022/Unun';

export function SiteFooter({ locale, copy, nav }: SiteFooterProps) {
  const links = [
    { href: `/${locale}/kitchens`, label: nav.kitchens },
    { href: `/${locale}#offers`, label: nav.offers },
    { href: `/${locale}#pricing`, label: nav.pricing },
    { href: `/${locale}/credits`, label: copy.credits },
    { href: SOURCE_URL, label: copy.source },
  ];

  return (
    <footer className="bg-soot text-ash">
      <div className="page-column grid gap-10 py-14 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <Logo className="h-10 w-auto text-ember" />
          <p className="mt-6 max-w-[52ch] text-base text-ash/80">{copy.about}</p>
        </div>
        <ul className="flex flex-col gap-3 text-base">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="underline underline-offset-8 hover:text-turmeric"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
