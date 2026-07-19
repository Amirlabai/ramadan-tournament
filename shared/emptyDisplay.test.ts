import { describe, expect, it } from 'vitest';
import { displayOrDash, isEmptyDisplayValue } from './emptyDisplay';

describe('isEmptyDisplayValue', () => {
  it('treats nullish, blank, and dash sentinels as empty', () => {
    expect(isEmptyDisplayValue(undefined)).toBe(true);
    expect(isEmptyDisplayValue(null)).toBe(true);
    expect(isEmptyDisplayValue('')).toBe(true);
    expect(isEmptyDisplayValue('   ')).toBe(true);
    expect(isEmptyDisplayValue('—')).toBe(true);
    expect(isEmptyDisplayValue('-')).toBe(true);
  });

  it('keeps real labels', () => {
    expect(isEmptyDisplayValue('בלם')).toBe(false);
    expect(isEmptyDisplayValue('  חלוץ  ')).toBe(false);
  });
});

describe('displayOrDash', () => {
  it('maps sentinels to ASCII hyphen', () => {
    expect(displayOrDash(undefined)).toBe('-');
    expect(displayOrDash('')).toBe('-');
    expect(displayOrDash('—')).toBe('-');
    expect(displayOrDash('-')).toBe('-');
  });

  it('trims real values', () => {
    expect(displayOrDash('  כינוי  ')).toBe('כינוי');
  });
});
