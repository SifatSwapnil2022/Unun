/** The visitor's delivery area is remembered in a cookie, so the server can render for it. */
export const AREA_COOKIE = 'unun_area';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Remembers the delivery area, or forgets it when given null. Browser only. */
export function rememberArea(areaId: string | null): void {
  document.cookie = areaId
    ? `${AREA_COOKIE}=${encodeURIComponent(areaId)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
    : `${AREA_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
