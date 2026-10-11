import { cookies } from 'next/headers';
import { AREA_COOKIE } from './area';

/** The delivery area the visitor chose earlier, if any. */
export async function readArea(): Promise<string | undefined> {
  const value = (await cookies()).get(AREA_COOKIE)?.value;
  return value && /^[a-z-]{2,40}$/.test(value) ? value : undefined;
}
