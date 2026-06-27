import { describe, expect, it } from 'vitest';
import {
  BIRTH_YEAR_MAX,
  BIRTH_YEAR_MIN,
  identitiesMatch,
  maskPersonalId,
  parseBirthYear,
} from './personalIdValidation';

describe('parseBirthYear', () => {
  it('accepts integer in range', () => {
    expect(parseBirthYear(2000)).toBe(2000);
    expect(parseBirthYear(BIRTH_YEAR_MIN)).toBe(BIRTH_YEAR_MIN);
    expect(parseBirthYear(BIRTH_YEAR_MAX)).toBe(BIRTH_YEAR_MAX);
  });

  it('accepts 4-digit string in range', () => {
    expect(parseBirthYear('2005')).toBe(2005);
  });

  it('rejects out-of-range or malformed values', () => {
    expect(() => parseBirthYear(1965)).toThrow();
    expect(() => parseBirthYear(2011)).toThrow();
    expect(() => parseBirthYear('99')).toThrow();
    expect(() => parseBirthYear('abcd')).toThrow();
    expect(() => parseBirthYear(2000.5)).toThrow();
  });
});

describe('maskPersonalId', () => {
  it('masks all but last 4 digits', () => {
    expect(maskPersonalId('123456782')).toBe('*****6782');
  });

  it('masks short IDs fully', () => {
    expect(maskPersonalId('1234')).toBe('****');
  });
});

describe('identitiesMatch', () => {
  it('requires matching encrypted ID and birth year', () => {
    expect(identitiesMatch('enc-a', 2000, 'enc-a', 2000)).toBe(true);
    expect(identitiesMatch('enc-a', 2000, 'enc-b', 2000)).toBe(false);
    expect(identitiesMatch('enc-a', 2000, 'enc-a', 2001)).toBe(false);
    expect(identitiesMatch(null, 2000, 'enc-a', 2000)).toBe(false);
    expect(identitiesMatch('enc-a', null, 'enc-a', 2000)).toBe(false);
  });
});
