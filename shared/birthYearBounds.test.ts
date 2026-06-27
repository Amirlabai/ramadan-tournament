import { describe, expect, it } from 'vitest';
import {
  BIRTH_YEAR_MAX,
  BIRTH_YEAR_MIN,
  isBirthYearInRange,
} from './birthYearBounds';

describe('birthYearBounds', () => {
  it('exports tournament eligibility range', () => {
    expect(BIRTH_YEAR_MIN).toBe(1966);
    expect(BIRTH_YEAR_MAX).toBe(2010);
  });

  it('validates 4-digit years in range', () => {
    expect(isBirthYearInRange('2000')).toBe(true);
    expect(isBirthYearInRange('1966')).toBe(true);
    expect(isBirthYearInRange('2010')).toBe(true);
  });

  it('rejects out-of-range or malformed years', () => {
    expect(isBirthYearInRange('1965')).toBe(false);
    expect(isBirthYearInRange('2011')).toBe(false);
    expect(isBirthYearInRange('200')).toBe(false);
    expect(isBirthYearInRange('abcd')).toBe(false);
  });
});
