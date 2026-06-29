import { describe, expect, it } from 'vitest';
import {
  extractBirthYearFromDate,
  findPersonalIdCandidates,
  parseCaptainBirthYear,
  parseFormIdentityField,
  validateFormIdentity,
} from './parseFormIdentityField';

describe('extractBirthYearFromDate', () => {
  it('parses dot slash dash dates', () => {
    expect(extractBirthYearFromDate('04/12/2000')).toBe(2000);
    expect(extractBirthYearFromDate('6.7.1998')).toBe(1998);
    expect(extractBirthYearFromDate('22-06-1994')).toBe(1994);
  });

  it('parses two-digit year', () => {
    expect(extractBirthYearFromDate('22.10.93')).toBe(1993);
  });

  it('rejects out-of-range years', () => {
    expect(extractBirthYearFromDate('10.2.2011')).toBeNull();
    expect(extractBirthYearFromDate('1965')).toBeNull();
  });

  it('accepts boundary years', () => {
    expect(extractBirthYearFromDate('1966')).toBe(1966);
    expect(extractBirthYearFromDate('2010')).toBe(2010);
  });
});

describe('parseCaptainBirthYear', () => {
  it('handles plain year and full dates', () => {
    expect(parseCaptainBirthYear('1981')).toBe(1981);
    expect(parseCaptainBirthYear('1992')).toBe(1992);
    expect(parseCaptainBirthYear('22/05/1990')).toBe(1990);
    expect(parseCaptainBirthYear('14.3.1997')).toBe(1997);
  });
});

describe('findPersonalIdCandidates', () => {
  it('ignores 10-digit phone numbers', () => {
    expect(findPersonalIdCandidates('0525330291')).toEqual([]);
  });

  it('finds leading-zero IDs', () => {
    const ids = findPersonalIdCandidates('043382753');
    expect(ids).toContain('043382753');
  });
});

describe('parseFormIdentityField — CSV fixtures', () => {
  const cases: Array<{
    raw: string;
    personalId?: string;
    birthYear?: number;
    partial?: 'missing_id' | 'missing_birth_year';
    null?: boolean;
  }> = [
    { raw: '211638085 - 04/12/2000', personalId: '211638085', birthYear: 2000 },
    { raw: 'ת.ז:322248881  תאריך לידה:14.5.2001', personalId: '322248881', birthYear: 2001 },
    { raw: '305347338   22.08.1990', personalId: '305347338', birthYear: 1990 },
    { raw: '10.2.2011', null: true },
    { raw: '3.2.1986', partial: 'missing_id' },
    { raw: '308399435', partial: 'missing_birth_year', personalId: '308399435' },
    { raw: '206879140', partial: 'missing_birth_year', personalId: '206879140' },
    { raw: '02/12/2002 213345069', personalId: '213345069', birthYear: 2002 },
    { raw: '319061131 - 6.7.1998', personalId: '319061131', birthYear: 1998 },
    { raw: '22.10.93', partial: 'missing_id' },
    { raw: '', null: true },
    { raw: '   ', null: true },
    { raw: 'garbage!!!', null: true },
  ];

  it.each(cases)('parses $raw', ({ raw, personalId, birthYear, partial, null: expectNull }) => {
    const result = parseFormIdentityField(raw);
    if (expectNull) {
      expect(result).toBeNull();
      return;
    }
    expect(result).not.toBeNull();
    if (partial) {
      expect(result?.partial).toBe(partial);
      if (personalId) expect(result?.personalId).toBe(personalId);
      if (birthYear != null) expect(result?.birthYear).toBe(birthYear);
      return;
    }
    expect(result?.personalId).toBe(personalId);
    expect(result?.birthYear).toBe(birthYear);
    expect(result?.partial).toBeUndefined();
  });

  it('never throws on garbage', () => {
    expect(() => parseFormIdentityField('!!!@@@')).not.toThrow();
  });
});

describe('validateFormIdentity', () => {
  it('accepts valid Luhn ID and year', () => {
    const r = validateFormIdentity('043382753', 1981);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.personalId).toBe('043382753');
      expect(r.birthYear).toBe(1981);
    }
  });

  it('returns invalid_luhn without throw', () => {
    const r = validateFormIdentity('123456789', 1990);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_luhn');
  });

  it('returns birth_year_out_of_range without throw', () => {
    expect(validateFormIdentity('043382753', 2011).ok).toBe(false);
    expect(validateFormIdentity('043382753', 1965).ok).toBe(false);
    const r = validateFormIdentity('043382753', 2011);
    if (!r.ok) expect(r.reason).toBe('birth_year_out_of_range');
  });
});
