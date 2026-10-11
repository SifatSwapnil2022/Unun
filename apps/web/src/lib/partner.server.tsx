import type { PartnerKitchenDto, UserDto } from '@unun/core/contracts';
import type { ReactElement } from 'react';
import { WorkspaceShell, type WorkTab } from '@/components/work/WorkspaceShell';
import { WrongRole } from '@/components/work/WrongRole';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import type { Api } from './api';
import { requireRole, serverApi } from './session.server';

export type PartnerPage = 'orders' | 'menu';

type Opened =
  /** The page cannot be shown. Render this instead. */
  | { ready: false; view: ReactElement }
  | {
      ready: true;
      api: Api;
      user: UserDto;
      kitchens: PartnerKitchenDto[];
      /** The kitchen the page is about. */
      kitchen: PartnerKitchenDto;
      tabs: { label: string; items: WorkTab[] };
    };

/**
 * What both pages of the owner's workspace need first: an owner who is signed in, the
 * kitchens they run, and the one the address asks for.
 */
export async function openPartnerPage(input: {
  locale: Locale;
  dictionary: Dictionary;
  page: PartnerPage;
  /** The kitchen named in the address, if any. */
  requested: string | undefined;
}): Promise<Opened> {
  const { locale, dictionary, page, requested } = input;
  const copy = dictionary.partner;
  const base = `/${locale}/partner`;
  const path = page === 'menu' ? `${base}/menu` : base;

  const access = await requireRole(locale, 'owner', path);
  if (!access.allowed) {
    return {
      ready: false,
      view: (
        <WrongRole
          locale={locale}
          dictionary={dictionary}
          role="owner"
          user={access.user}
          path={path}
        />
      ),
    };
  }

  const api = await serverApi();
  const kitchens = await api.partnerKitchens();
  const kitchen = kitchens.find((owned) => owned.slug === requested) ?? kitchens[0];

  if (!kitchen) {
    return {
      ready: false,
      view: (
        <WorkspaceShell locale={locale} dictionary={dictionary} title={copy.title}>
          <h2 className="display text-[clamp(1.6rem,3vw,2.2rem)]">
            {copy.noKitchenTitle}
          </h2>
          <p className="mt-4 max-w-[52ch] text-lg">{copy.noKitchenBody}</p>
        </WorkspaceShell>
      ),
    };
  }

  // The chosen kitchen is carried from tab to tab, but only when there is a choice.
  const query = kitchens.length > 1 ? `?kitchen=${kitchen.slug}` : '';
  return {
    ready: true,
    api,
    user: access.user,
    kitchens,
    kitchen,
    tabs: {
      label: copy.nav.label,
      items: [
        { href: `${base}${query}`, label: copy.nav.orders, current: page === 'orders' },
        { href: `${base}/menu${query}`, label: copy.nav.menu, current: page === 'menu' },
      ],
    },
  };
}
