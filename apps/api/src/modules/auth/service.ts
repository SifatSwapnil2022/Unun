/**
 * Signing in. A person proves they hold a mobile number by typing a one-time code sent
 * to it; there are no passwords to leak or forget. A session is a random token kept in
 * a cookie, of which only a hash is stored.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  LOGIN_CODE_LENGTH,
  normaliseLoginCode,
  normaliseMobile,
  type UserRole,
} from '@unun/core';
import type { CodeSent, DemoAccountDto, UserDto } from '@unun/core/contracts';
import { and, count, desc, eq, gt, inArray, isNull, lt } from 'drizzle-orm';
import type { Config } from '../../config';
import type { Database } from '../../db/client';
import { kitchens, loginCodes, orders, sessions, users } from '../../db/schema';
import { ApiError } from '../../http/errors';
import { demoAccountSeeds } from '../../seed/accounts';

export type UserRow = typeof users.$inferSelect;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A code works for this long. */
export const CODE_LIFETIME_MS = 5 * MINUTE_MS;
/** Wrong guesses allowed before a code stops working. */
export const CODE_ATTEMPTS = 5;
/** Codes one number may ask for within the window below. */
export const CODES_PER_WINDOW = 5;
const CODE_WINDOW_MS = 10 * MINUTE_MS;

export const SESSION_LIFETIME_MS = 30 * DAY_MS;

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/*
 * A six-digit code can be found by trying every value, so hashing it protects nobody
 * who holds the database for long. It does keep live codes out of backups and logs,
 * and binding the hash to the number stops one row being reused for another number.
 */
const hashCode = (phone: string, code: string) => sha256(`${phone}:${code}`);

const sameHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const toUserDto = (user: UserRow): UserDto => ({
  id: user.id,
  name: user.name,
  phone: user.phone,
  role: user.role,
});

function requireMobile(input: string): string {
  const phone = normaliseMobile(input);
  if (!phone) {
    throw new ApiError(
      'invalid_phone',
      'Enter a Bangladeshi mobile number, for example 01712345678.',
    );
  }
  return phone;
}

/** Delivers a code to its owner. */
export type CodeSender = (phone: string, code: string) => Promise<void>;

/** Used when no SMS gateway is connected: the code is printed where the API runs. */
export const logCodeInstead: CodeSender = async (phone, code) => {
  console.log(`No SMS gateway is configured. Sign-in code for ${phone}: ${code}`);
};

export async function requestCode(
  db: Database,
  config: Config,
  input: { phone: string; now: Date; send: CodeSender },
): Promise<CodeSent> {
  const phone = requireMobile(input.phone);
  const { now } = input;

  // Old rows are of no use to anyone. Clearing them here needs no scheduled job.
  await db
    .delete(loginCodes)
    .where(
      and(
        eq(loginCodes.phone, phone),
        lt(loginCodes.createdAt, new Date(now.getTime() - DAY_MS)),
      ),
    );

  const [recent] = await db
    .select({ total: count() })
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.phone, phone),
        gt(loginCodes.createdAt, new Date(now.getTime() - CODE_WINDOW_MS)),
      ),
    );
  if ((recent?.total ?? 0) >= CODES_PER_WINDOW) {
    throw new ApiError(
      'rate_limited',
      'Too many codes were requested for this number. Try again in a few minutes.',
    );
  }

  const code = String(randomInt(10 ** LOGIN_CODE_LENGTH)).padStart(
    LOGIN_CODE_LENGTH,
    '0',
  );
  await db.insert(loginCodes).values({
    phone,
    codeHash: hashCode(phone, code),
    createdAt: now,
    expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
  });

  if (!config.demoLogin) await input.send(phone, code);

  return {
    expiresInSeconds: CODE_LIFETIME_MS / 1000,
    demoCode: config.demoLogin ? code : null,
  };
}

export type StartedSession = {
  user: UserRow;
  /** Goes into the cookie. It is not stored and cannot be read back. */
  token: string;
  expiresAt: Date;
};

const wrongCode = (attemptsLeft?: number) =>
  new ApiError(
    'invalid_code',
    'That code is wrong or has expired.',
    attemptsLeft === undefined ? undefined : { attemptsLeft },
  );

export async function verifyCode(
  db: Database,
  input: { phone: string; code: string; now: Date },
): Promise<StartedSession> {
  const phone = requireMobile(input.phone);
  const code = normaliseLoginCode(input.code);
  const { now } = input;
  if (!code) throw wrongCode();

  // Only the newest code counts. Asking for a new one retires the one before it.
  const [latest] = await db
    .select()
    .from(loginCodes)
    .where(eq(loginCodes.phone, phone))
    .orderBy(desc(loginCodes.createdAt), desc(loginCodes.id))
    .limit(1);

  if (
    !latest ||
    latest.usedAt !== null ||
    latest.expiresAt.getTime() <= now.getTime() ||
    latest.attempts >= CODE_ATTEMPTS
  ) {
    throw wrongCode();
  }

  if (!sameHash(latest.codeHash, hashCode(phone, code))) {
    const attempts = latest.attempts + 1;
    await db.update(loginCodes).set({ attempts }).where(eq(loginCodes.id, latest.id));
    throw wrongCode(CODE_ATTEMPTS - attempts);
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);

  const user = await db.transaction(async (tx) => {
    // The code is spent in the same step that checks it is unspent, so it works once.
    const spent = await tx
      .update(loginCodes)
      .set({ usedAt: now })
      .where(and(eq(loginCodes.id, latest.id), isNull(loginCodes.usedAt)))
      .returning({ id: loginCodes.id });
    if (spent.length === 0) throw wrongCode();

    let [account] = await tx.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!account) {
      [account] = await tx.insert(users).values({ phone, createdAt: now }).returning();
    }
    if (!account) throw new Error('The user row was not created');

    // Orders placed with this number before signing in belong to its holder.
    await tx
      .update(orders)
      .set({ userId: account.id })
      .where(and(eq(orders.customerPhone, phone), isNull(orders.userId)));

    await tx.delete(sessions).where(lt(sessions.expiresAt, now));
    await tx.insert(sessions).values({
      tokenHash: sha256(token),
      userId: account.id,
      createdAt: now,
      expiresAt,
    });

    return account;
  });

  return { user, token, expiresAt };
}

/** The user a session token belongs to, or null if the session is unknown or over. */
export async function findSessionUser(
  db: Database,
  token: string,
  now: Date,
): Promise<UserRow | null> {
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  return row?.user ?? null;
}

export async function endSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

export async function updateName(
  db: Database,
  userId: number,
  name: string,
): Promise<UserRow> {
  const [user] = await db
    .update(users)
    .set({ name })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw new ApiError('unauthorized', 'Sign in to continue.');
  return user;
}

const ROLE_ORDER: UserRole[] = ['customer', 'owner', 'rider', 'admin'];

/** The seeded accounts a visitor may sign in to. Empty unless demo sign-in is on. */
export async function listDemoAccounts(
  db: Database,
  config: Config,
): Promise<DemoAccountDto[]> {
  if (!config.demoLogin) return [];

  const phones = demoAccountSeeds.map((account) => account.phone);
  const [accounts, owned] = await Promise.all([
    db.select().from(users).where(inArray(users.phone, phones)),
    db
      .select({
        ownerId: kitchens.ownerId,
        nameEn: kitchens.nameEn,
        nameBn: kitchens.nameBn,
      })
      .from(kitchens)
      .innerJoin(users, eq(users.id, kitchens.ownerId))
      .where(inArray(users.phone, phones)),
  ]);

  return accounts
    .sort(
      (a, b) =>
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
        a.phone.localeCompare(b.phone),
    )
    .map((account) => {
      const kitchen = owned.find((row) => row.ownerId === account.id);
      return {
        role: account.role,
        name: account.name,
        phone: account.phone,
        kitchen: kitchen ? { en: kitchen.nameEn, bn: kitchen.nameBn } : null,
      };
    });
}

/** Makes the holder of a number an admin, creating the account if it is new. */
export async function ensureAdmin(db: Database, phone: string, now: Date): Promise<void> {
  await db
    .insert(users)
    .values({ phone, role: 'admin', createdAt: now })
    .onConflictDoUpdate({ target: users.phone, set: { role: 'admin' } });
}
