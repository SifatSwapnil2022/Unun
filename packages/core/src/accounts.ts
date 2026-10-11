/**
 * People who use Unun. Everyone can order food; a role adds a workspace on top.
 */
export const USER_ROLES = ['customer', 'owner', 'rider', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** One-time sign-in codes are this many digits. */
export const LOGIN_CODE_LENGTH = 6;

const LOGIN_CODE = new RegExp(`^\\d{${LOGIN_CODE_LENGTH}}$`);

/** Accepts a code as people type it: digits, perhaps with spaces between them. */
export function normaliseLoginCode(input: string): string | null {
  const digits = input.replace(/\s/g, '');
  return LOGIN_CODE.test(digits) ? digits : null;
}

/** The name to greet someone by: the first word of what they entered. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
