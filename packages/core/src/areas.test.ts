import { describe, expect, it } from 'vitest';
import { matchArea } from './areas';

const areas = [
  { id: 'dhanmondi', names: ['Dhanmondi', 'ধানমন্ডি', 'Jigatola'] },
  { id: 'gulshan', names: ['Gulshan', 'গুলশান'] },
  { id: 'mirpur', names: ['Mirpur', 'মিরপুর'] },
  { id: 'old-dhaka', names: ['Old Dhaka', 'পুরান ঢাকা', 'Lalbagh', 'Chawkbazar'] },
];

describe('matchArea', () => {
  it('finds an area by its English name, whatever the letter case', () => {
    expect(matchArea('dhanmondi', areas)?.id).toBe('dhanmondi');
    expect(matchArea('  GULSHAN ', areas)?.id).toBe('gulshan');
  });

  it('finds an area by its Bangla name', () => {
    expect(matchArea('ধানমন্ডি', areas)?.id).toBe('dhanmondi');
    expect(matchArea('পুরান ঢাকা', areas)?.id).toBe('old-dhaka');
  });

  it('finds an area by a neighbourhood inside it', () => {
    expect(matchArea('Lalbagh fort road', areas)?.id).toBe('old-dhaka');
  });

  it('accepts a fuller address that contains the area name', () => {
    expect(matchArea('House 12, Road 27, Dhanmondi', areas)?.id).toBe('dhanmondi');
  });

  it('accepts the first few letters of a name', () => {
    expect(matchArea('mir', areas)?.id).toBe('mirpur');
  });

  it('returns nothing for empty, very short or unknown input', () => {
    expect(matchArea('', areas)).toBeNull();
    expect(matchArea('dh', areas)).toBeNull();
    expect(matchArea('Chattogram', areas)).toBeNull();
  });
});
