import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { HOME_BY_ROLE } from '@/lib/roles';
import { currentUser } from '@/lib/session.server';
import { MobileTabsNav, type MobileTab } from './MobileTabsNav';

type MobileTabsProps = {
  locale: Locale;
  copy: Dictionary['nav'];
};

/**
 * The bar at the bottom of a phone screen, where a thumb reaches: home, kitchens, the
 * bag, and the place the signed-in person's role starts. On wider screens the header
 * carries the same links and this is not shown.
 */
export async function MobileTabs({ locale, copy }: MobileTabsProps) {
  const user = await currentUser();
  const { tabs } = copy;

  const last: MobileTab = user
    ? {
        key: 'account',
        href: `/${locale}/${HOME_BY_ROLE[user.role]}`,
        label: user.role === 'customer' ? tabs.account : tabs[user.role],
      }
    : { key: 'account', href: `/${locale}/sign-in`, label: tabs.signIn };

  const items: MobileTab[] = [
    { key: 'home', href: `/${locale}`, label: tabs.home },
    { key: 'kitchens', href: `/${locale}/kitchens`, label: tabs.kitchens },
    { key: 'bag', href: `/${locale}/checkout`, label: tabs.bag },
    last,
  ];

  return (
    <MobileTabsNav locale={locale} label={tabs.label} items={items} bagCopy={copy} />
  );
}
