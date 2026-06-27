import { describe, expect, it } from 'vitest';
import { singleRoundRobinPairs } from './roundRobin';

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function allPairsUnique(pairs: [number, number][]): boolean {
  const seen = new Set<string>();
  for (const [a, b] of pairs) {
    const key = pairKey(a, b);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

describe('singleRoundRobinPairs', () => {
  it('returns empty for fewer than 2 teams', () => {
    expect(singleRoundRobinPairs([])).toEqual([]);
    expect(singleRoundRobinPairs([1])).toEqual([]);
  });

  it('schedules one match for two teams', () => {
    expect(singleRoundRobinPairs([10, 20])).toEqual([[10, 20]]);
  });

  it('covers every pairing once for four teams', () => {
    const pairs = singleRoundRobinPairs([1, 2, 3, 4]);
    expect(pairs).toHaveLength(6);
    expect(allPairsUnique(pairs)).toBe(true);
    const expected = new Set(['1-2', '1-3', '1-4', '2-3', '2-4', '3-4']);
    const actual = new Set(pairs.map(([a, b]) => pairKey(a, b)));
    expect(actual).toEqual(expected);
  });

  it('handles odd team count with a bye', () => {
    const pairs = singleRoundRobinPairs([1, 2, 3]);
    expect(pairs).toHaveLength(3);
    expect(allPairsUnique(pairs)).toBe(true);
    for (const [a, b] of pairs) {
      expect(a).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(0);
    }
  });
});
