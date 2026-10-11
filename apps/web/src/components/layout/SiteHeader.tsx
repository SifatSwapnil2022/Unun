import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { AccountLink } from './AccountLink';
import { BagLink } from './BagLink';
import { LocaleSwitch } from './LocaleSwitch';

type SiteHeaderProps = {
  locale: Locale;
  copy: Dictionary['nav'];
  /** Draw the logo stroke by stroke. Used once, on the home page. */
  drawLogo?: boolean;
};

/** The header always sits on a dark ground: the hero on the home page, a soot bar elsewhere. */
export function SiteHeader({ locale, copy, drawLogo = false }: SiteHeaderProps) {
  const links = [
    { href: `/${locale}/kitchens`, label: copy.kitchens },
    { href: `/${locale}#offers`, label: copy.offers },
    { href: `/${locale}#pricing`, label: copy.pricing },
  ];

  return (
    <header className="page-column site-header flex items-center justify-between gap-4">
      <Link
        href={`/${locale}`}
        aria-label={copy.home}
        className="block shrink-0 text-ember"
      >
        <Logo draw={drawLogo} className="h-10 w-auto sm:h-12" />
      </Link>

      <nav
        aria-label={copy.main}
        className="hidden items-center gap-8 text-base text-ash md:flex"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="underline-offset-8 hover:text-turmeric hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* On a phone the bag and the account are in the tab bar at the bottom. */}
        <div className="hidden items-center gap-1.5 sm:gap-3 md:flex">
          <BagLink locale={locale} copy={copy} />
          <AccountLink locale={locale} copy={copy} />
        </div>
        <LocaleSwitch
          locale={locale}
          label={copy.switchLanguage}
          accessibleLabel={copy.switchLanguageLabel}
        />
      </div>
    </header>
  );
}

/** The header on its soot bar, for every page except the home page. */
export function SiteHeaderBar(props: SiteHeaderProps) {
  return (
    <div className="bg-soot pb-6 text-ash sm:pb-7">
      <SiteHeader {...props} />
    </div>
  );
}
