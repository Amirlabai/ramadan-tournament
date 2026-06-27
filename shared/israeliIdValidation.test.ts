import { describe, expect, it } from 'vitest';
import {
  isValidIsraeliId,
  normalizePersonalId,
  sanitizePersonalIdInput,
} from './israeliIdValidation';

describe('isValidIsraeliId', () => {
  it('accepts a valid 9-digit ID', () => {
    expect(isValidIsraeliId('123456782')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isValidIsraeliId('12345678')).toBe(false);
    expect(isValidIsraeliId('1234567890')).toBe(false);
  });

  it('rejects invalid checksum', () => {
    expect(isValidIsraeliId('123456789')).toBe(false);
  });

  it('rejects zero and strips non-digits before validation', () => {
    expect(isValidIsraeliId('000000000')).toBe(false);
    expect(isValidIsraeliId('123-456-782')).toBe(true);
  });
});

describe('normalizePersonalId', () => {
  it('returns digits for valid ID', () => {
    expect(normalizePersonalId('123456782')).toBe('123456782');
  });

  it('throws on invalid checksum', () => {
    expect(() => normalizePersonalId('123456789')).toThrow('מספר תעודת זהות לא עובר בדיקת תקינות');
  });

  it('throws when not exactly 9 digits after sanitizing', () => {
    expect(() => normalizePersonalId('12345')).toThrow('תעודת זהות חייבת להכיל בדיוק 9 ספרות');
  });
});

describe('sanitizePersonalIdInput', () => {
  it('keeps digits only and caps at 9', () => {
    expect(sanitizePersonalIdInput('12-34-567-890-extra')).toBe('123456789');
    expect(sanitizePersonalIdInput('abc')).toBe('');
  });
});
