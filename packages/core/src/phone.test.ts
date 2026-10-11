import { describe, expect, it } from 'vitest';
import { maskMobile, normaliseMobile } from './phone';

describe('normaliseMobile', () => {
  it('accepts the local form', () => {
    expect(normaliseMobile('01712345678')).toBe('01712345678');
  });

  it('accepts the country code, with or without a plus sign', () => {
    expect(normaliseMobile('+8801712345678')).toBe('01712345678');
    expect(normaliseMobile('8801912345678')).toBe('01912345678');
  });

  it('ignores spaces, dashes and brackets', () => {
    expect(normaliseMobile('+880 1712-345 678')).toBe('01712345678');
    expect(normaliseMobile('(017) 1234 5678')).toBe('01712345678');
  });

  it('accepts a number typed without its leading zero', () => {
    expect(normaliseMobile('1712345678')).toBe('01712345678');
  });

  it('rejects landlines, short numbers, unused prefixes and words', () => {
    expect(normaliseMobile('029123456')).toBeNull();
    expect(normaliseMobile('0171234567')).toBeNull();
    expect(normaliseMobile('01212345678')).toBeNull();
    expect(normaliseMobile('call me')).toBeNull();
    expect(normaliseMobile('')).toBeNull();
  });
});

describe('maskMobile', () => {
  it('keeps the operator prefix and the last three digits', () => {
    expect(maskMobile('01712345678')).toBe('017•••••678');
  });
});
