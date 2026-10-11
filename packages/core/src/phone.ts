/**
 * Bangladeshi mobile numbers. Operators use the prefixes 013 to 019, and a number has
 * eleven digits in its local form.
 */
const LOCAL_FORM = /^01[3-9]\d{8}$/;

/**
 * Returns the number in local form (01712345678), or null if it is not a Bangladeshi
 * mobile number. Spaces, dashes, brackets and the +880 country code are accepted.
 */
export function normaliseMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('880')) digits = digits.slice(2);
  else if (digits.startsWith('1') && digits.length === 10) digits = `0${digits}`;

  return LOCAL_FORM.test(digits) ? digits : null;
}

/** Hides the middle of a number for display: 01712345678 becomes 017•••••678. */
export function maskMobile(local: string): string {
  return `${local.slice(0, 3)}•••••${local.slice(-3)}`;
}
