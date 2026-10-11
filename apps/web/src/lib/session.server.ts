import type { UserRole } from '@unun/core';
import type { UserDto } from '@unun/core/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createApi, type Api } from './api';

/** Must match the name the API sets. */
const SESSION_COOKIE = 'unun_session';

/**
 * The API client for this request's visitor. Server components have no browser to
 * carry the session cookie, so it is passed on by hand.
 */
export const serverApi = cache(async (): Promise<Api> => {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  return createApi(session ? { Cookie: `${SESSION_COOKIE}=${session}` } : {});
});

/**
 * The signed-in visitor, or null. Asked once per request however many components need
 * it. If the API cannot be reached the visitor is treated as signed out, and the page's
 * own request for data reports the failure.
 */
export const currentUser = cache(async (): Promise<UserDto | null> => {
  try {
    return (await (await serverApi()).me()).user;
  } catch {
    return null;
  }
});

export type Access =
  | { allowed: true; user: UserDto }
  /** Signed in, but with an account that has another role. */
  | { allowed: false; user: UserDto };

/**
 * Guards a workspace page. A visitor who is not signed in is sent to sign in and
 * brought back; one with the wrong role is told so by the page.
 */
export async function requireRole(
  locale: string,
  role: UserRole,
  path: string,
): Promise<Access> {
  const user = await currentUser();
  if (!user) redirect(`/${locale}/sign-in?next=${encodeURIComponent(path)}`);
  return { allowed: user.role === role, user };
}

/** The signed-in visitor. Anyone else is sent to sign in and brought back. */
export async function requireUser(locale: string, path: string): Promise<UserDto> {
  const user = await currentUser();
  if (!user) redirect(`/${locale}/sign-in?next=${encodeURIComponent(path)}`);
  return user;
}
