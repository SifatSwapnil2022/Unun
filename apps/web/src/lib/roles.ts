import type { UserRole } from '@unun/core';

/** The page each role starts on after signing in, under the locale. */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  customer: 'account',
  owner: 'partner',
  rider: 'rider',
  admin: 'admin',
};

/**
 * A "come back here after signing in" address is only followed if it is a page of this
 * site in the same language. Anything else, such as another site's address, is dropped,
 * so a crafted sign-in link cannot send someone elsewhere.
 */
export function safeNext(next: string | undefined, locale: string): string | null {
  if (!next) return null;
  const inLocale = next === `/${locale}` || next.startsWith(`/${locale}/`);
  return inLocale && !next.includes('//') && !next.includes('\\') ? next : null;
}
