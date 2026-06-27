import { describe, expect, it } from 'vitest';
import { isUuid, sanitizeSearchQuery } from './sanitizeSearchQuery';

describe('sanitizeSearchQuery', () => {
  it('trims, caps length, and strips LIKE wildcards', () => {
    expect(sanitizeSearchQuery('  hello%world_\\  ')).toBe('helloworld');
    expect(sanitizeSearchQuery('x'.repeat(150), 10)).toBe('x'.repeat(10));
  });
});

describe('isUuid', () => {
  it('accepts valid UUID v4', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('550e8400-e29b-41d4-a716')).toBe(false);
  });
});
