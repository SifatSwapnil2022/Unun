import { firstName } from '@unun/core';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { HOME_BY_ROLE } from '@/lib/roles';
import { currentUser } from '@/lib/session.server';

type AccountLinkProps = {
  locale: Locale;
  copy: Dictionary['nav'];
};

/**
 * "Sign in" for a visitor. For someone signed in, their first name, which leads to the
 * place their role starts: the account page, the kitchen's orders, deliveries or admin.
 */
export async function AccountLink({ locale, copy }: AccountLinkProps) {
  const user = await currentUser();

  if (!user) {
    return (
      <Link href={`/${locale}/sign-in`} className="header-pill">
        {copy.signIn}
      </Link>
    );
  }

  const name = firstName(user.name);
  return (
    <Link
      href={`/${locale}/${HOME_BY_ROLE[user.role]}`}
      aria-label={name ? `${name}: ${copy.workspace[user.role]}` : undefined}
      className="header-pill max-w-[9rem] truncate"
    >
      {name || copy.workspace[user.role]}
    </Link>
  );
}
