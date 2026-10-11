import type { UserDto } from '@unun/core/contracts';
import type { ReactElement } from 'react';
import type { WorkTab } from '@/components/work/WorkspaceShell';
import { WrongRole } from '@/components/work/WrongRole';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import type { Api } from './api';
import { requireRole, serverApi } from './session.server';

export type AdminPage =
  'overview' | 'orders' | 'issues' | 'reviews' | 'kitchens' | 'people';

const PATH_OF: Record<AdminPage, string> = {
  overview: '',
  orders: '/orders',
  issues: '/issues',
  reviews: '/reviews',
  kitchens: '/kitchens',
  people: '/people',
};

type Opened =
  /** The page cannot be shown. Render this instead. */
  | { ready: false; view: ReactElement }
  | {
      ready: true;
      api: Api;
      user: UserDto;
      tabs: { label: string; items: WorkTab[] };
    };

/** What every admin page needs first: an admin who is signed in, and the page tabs. */
export async function openAdminPage(input: {
  locale: Locale;
  dictionary: Dictionary;
  page: AdminPage;
}): Promise<Opened> {
  const { locale, dictionary, page } = input;
  const base = `/${locale}/admin`;
  const path = `${base}${PATH_OF[page]}`;

  const access = await requireRole(locale, 'admin', path);
  if (!access.allowed) {
    return {
      ready: false,
      view: (
        <WrongRole
          locale={locale}
          dictionary={dictionary}
          role="admin"
          user={access.user}
          path={path}
        />
      ),
    };
  }

  const { nav } = dictionary.admin;
  return {
    ready: true,
    api: await serverApi(),
    user: access.user,
    tabs: {
      label: nav.label,
      items: (Object.keys(PATH_OF) as AdminPage[]).map((key) => ({
        href: `${base}${PATH_OF[key]}`,
        label: nav[key],
        current: key === page,
      })),
    },
  };
}
