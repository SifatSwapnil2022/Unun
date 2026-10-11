import { describe, expect, it } from 'vitest';
import { firstName, normaliseLoginCode } from './accounts';

describe('normaliseLoginCode', () => {
  it('accepts six digits, with or without spaces', () => {
    expect(normaliseLoginCode('482913')).toBe('482913');
    expect(normaliseLoginCode(' 482 913 ')).toBe('482913');
  });

  it('refuses anything else', () => {
    expect(normaliseLoginCode('48291')).toBeNull();
    expect(normaliseLoginCode('4829130')).toBeNull();
    expect(normaliseLoginCode('48291a')).toBeNull();
    expect(normaliseLoginCode('')).toBeNull();
  });
});

describe('firstName', () => {
  it('takes the first word', () => {
    expect(firstName('Rahim Uddin')).toBe('Rahim');
    expect(firstName('  Jamal  ')).toBe('Jamal');
    expect(firstName('')).toBe('');
  });
});
