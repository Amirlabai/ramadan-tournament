import { describe, expect, it } from 'vitest';
import { safeImageExt } from './safeImageExt';

describe('safeImageExt', () => {
  it('allows common image extensions', () => {
    expect(safeImageExt('a.JPG')).toBe('.jpg');
    expect(safeImageExt('a.jpeg')).toBe('.jpeg');
    expect(safeImageExt('a.png')).toBe('.png');
    expect(safeImageExt('a.webp')).toBe('.webp');
    expect(safeImageExt('a.gif')).toBe('.gif');
  });

  it('defaults unsafe extensions to .jpg', () => {
    expect(safeImageExt('a.exe')).toBe('.jpg');
    expect(safeImageExt('a')).toBe('.jpg');
    expect(safeImageExt('')).toBe('.jpg');
    expect(safeImageExt(null)).toBe('.jpg');
  });
});
