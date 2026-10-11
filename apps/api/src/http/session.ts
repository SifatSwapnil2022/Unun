import type { UserRole } from '@unun/core';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Config } from '../config';
import type { Database } from '../db/client';
import {
  endSession,
  findSessionUser,
  type StartedSession,
  type UserRow,
} from '../modules/auth/service';
import { ApiError } from './errors';

export const SESSION_COOKIE = 'unun_session';

export type Sessions = {
  /** The signed-in user, or null. */
  current: (c: Context) => Promise<UserRow | null>;
  /** The signed-in user. Fails with 401 when nobody is signed in. */
  require: (c: Context) => Promise<UserRow>;
  /** The signed-in user, who must hold one of the roles. Fails with 401 or 403. */
  requireRole: (c: Context, ...roles: UserRole[]) => Promise<UserRow>;
  start: (c: Context, session: StartedSession) => void;
  end: (c: Context) => Promise<void>;
};

export function createSessions(db: Database, config: Config, now: () => Date): Sessions {
  const current: Sessions['current'] = async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    return token ? findSessionUser(db, token, now()) : null;
  };

  const require: Sessions['require'] = async (c) => {
    const user = await current(c);
    if (!user) throw new ApiError('unauthorized', 'Sign in to continue.');
    return user;
  };

  return {
    current,
    require,
    requireRole: async (c, ...roles) => {
      const user = await require(c);
      if (!roles.includes(user.role)) {
        throw new ApiError('forbidden', 'Your account cannot do this.');
      }
      return user;
    },
    start: (c, session) => {
      setCookie(c, SESSION_COOKIE, session.token, {
        // Scripts on the page cannot read the cookie, and other sites cannot send it
        // with a request that changes anything.
        httpOnly: true,
        sameSite: 'Lax',
        secure: config.secureCookies,
        path: '/',
        expires: session.expiresAt,
      });
    },
    end: async (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      if (token) await endSession(db, token);
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
    },
  };
}
