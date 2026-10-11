import { describe, expect, it } from 'vitest';
import { parseAvoiding } from './hooks/useAvoiding';

describe('parseAvoiding', () => {
  it('reads a stored list into the standard order', () => {
    expect(parseAvoiding('["nuts","milk"]')).toEqual(['milk', 'nuts']);
  });

  it('drops what it does not know', () => {
    expect(parseAvoiding('["milk","dairy",7,null]')).toEqual(['milk']);
  });

  it('treats anything broken as nothing', () => {
    for (const text of [null, '', 'not json', '{"milk":true}', '"milk"', '[]']) {
      expect(parseAvoiding(text)).toEqual([]);
    }
  });
});
