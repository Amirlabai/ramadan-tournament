import { describe, expect, it } from 'vitest';
import { normalizeEmail } from './normalizeEmail';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
  });

  it('strips subaddressing', () => {
    expect(normalizeEmail('user+tag@gmail.com')).toBe('user@gmail.com');
    expect(normalizeEmail('user+foo.bar@example.com')).toBe('user@example.com');
  });

  it('removes dots from Gmail local part', () => {
    expect(normalizeEmail('john.doe@gmail.com')).toBe('johndoe@gmail.com');
    expect(normalizeEmail('j.o.h.n.d.o.e@gmail.com')).toBe('johndoe@gmail.com');
  });

  it('normalizes googlemail.com to gmail.com', () => {
    expect(normalizeEmail('user@googlemail.com')).toBe('user@gmail.com');
    expect(normalizeEmail('john.doe@googlemail.com')).toBe('johndoe@gmail.com');
  });

  it('does not strip dots on non-Gmail domains', () => {
    expect(normalizeEmail('john.doe@example.com')).toBe('john.doe@example.com');
  });

  it('combines Gmail dot and plus normalization', () => {
    expect(normalizeEmail('john.doe+news@gmail.com')).toBe('johndoe@gmail.com');
  });

  it('returns null for malformed addresses', () => {
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('a@@b.com')).toBeNull();
    expect(normalizeEmail('@example.com')).toBeNull();
    expect(normalizeEmail('user@')).toBeNull();
  });
});
