import { describe, expect, it } from 'vitest';
import { safeNext } from './roles';

describe('safeNext', () => {
  it('keeps a page of this site in the same language', () => {
    expect(safeNext('/en/checkout', 'en')).toBe('/en/checkout');
    expect(safeNext('/bn/partner/menu?kitchen=dum-ghor', 'bn')).toBe(
      '/bn/partner/menu?kitchen=dum-ghor',
    );
    expect(safeNext('/en', 'en')).toBe('/en');
  });

  it('drops addresses that leave the site or the language', () => {
    expect(safeNext('https://example.com/en/checkout', 'en')).toBeNull();
    expect(safeNext('//example.com/en', 'en')).toBeNull();
    expect(safeNext('/en//example.com', 'en')).toBeNull();
    expect(safeNext('/en\\example.com', 'en')).toBeNull();
    expect(safeNext('/bn/checkout', 'en')).toBeNull();
    expect(safeNext('/english', 'en')).toBeNull();
  });

  it('returns nothing when there is no address', () => {
    expect(safeNext(undefined, 'en')).toBeNull();
    expect(safeNext('', 'en')).toBeNull();
  });
});
