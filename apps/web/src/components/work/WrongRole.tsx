import type { UserRole } from '@unun/core';
import type { UserDto } from '@unun/core/contracts';
import Link from 'next/link';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeaderBar } from '@/components/layout/SiteHeader';
import { Notice } from '@/components/ui/Notice';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';

type WrongRoleProps = {
  locale: Locale;
  dictionary: Dictionary;
  /** The role the page is for. */
  role: UserRole;
  user: UserDto;
  /** The page itself, to come back to after signing in with another account. */
  path: string;
};

/** Shown to someone who is signed in, but with an account of another kind. */
export function WrongRole({ locale, dictionary, role, user, path }: WrongRoleProps) {
  const { work, roles, nav } = dictionary;

  return (
    <>
      <SiteHeaderBar locale={locale} copy={nav} />
      <main id="main" className="min-h-[60vh] bg-ash">
        <Notice
          title={fill(work.wrongRoleTitle, {
            role: roles[role].toLocaleLowerCase(locale),
          })}
          action={
            <Link
              href={`/${locale}/sign-in?next=${encodeURIComponent(path)}`}
              className="btn btn-dark"
            >
              {work.switchAccount}
            </Link>
          }
        >
          {fill(work.wrongRoleBody, {
            name: user.name || user.phone,
            own: roles[user.role].toLocaleLowerCase(locale),
          })}
        </Notice>
      </main>
      <SiteFooter locale={locale} copy={dictionary.footer} nav={nav} />
    </>
  );
}
