import { describe, expect, it } from 'vitest';
import { mergeProfilePosition } from './rosterAuditLog';

describe('mergeProfilePosition', () => {
  it('keeps existing when raw is undefined', () => {
    expect(mergeProfilePosition(undefined, 'בלם')).toBe('בלם');
  });

  it('keeps existing when raw is empty or whitespace', () => {
    expect(mergeProfilePosition('', 'בלם')).toBe('בלם');
    expect(mergeProfilePosition('   ', 'בלם')).toBe('בלם');
  });

  it('keeps existing when raw is empty sentinel', () => {
    expect(mergeProfilePosition('—', 'בלם')).toBe('בלם');
    expect(mergeProfilePosition('-', 'בלם')).toBe('בלם');
  });

  it('applies a non-empty new value', () => {
    expect(mergeProfilePosition('חלוץ', 'בלם')).toBe('חלוץ');
  });
});
