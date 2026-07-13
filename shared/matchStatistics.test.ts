import { describe, expect, it } from 'vitest';
import { jerusalemDateTime } from './jerusalemDate';
import {
  estimateWinChance,
  generateMatchStats,
  getMatchStatsIntervalBucket,
  hashMatchStatsSeed,
  MATCH_STATS_MAX_BUCKET,
  type MatchStatistics,
  type SidePair,
} from './matchStatistics';

function assertSideInvariants(
  stats: MatchStatistics,
  scoreA: number,
  scoreB: number
): void {
  expect(stats.possession.a + stats.possession.b).toBe(100);
  expect(stats.possession.a).toBeGreaterThanOrEqual(32);
  expect(stats.possession.a).toBeLessThanOrEqual(68);

  expect(stats.shots.a).toBeGreaterThanOrEqual(scoreA);
  expect(stats.shots.b).toBeGreaterThanOrEqual(scoreB);

  expect(stats.shotsOnTarget.a).toBeGreaterThanOrEqual(Math.min(scoreA, stats.shots.a));
  expect(stats.shotsOnTarget.b).toBeGreaterThanOrEqual(Math.min(scoreB, stats.shots.b));
  expect(stats.shotsOnTarget.a).toBeLessThanOrEqual(stats.shots.a);
  expect(stats.shotsOnTarget.b).toBeLessThanOrEqual(stats.shots.b);

  expect(stats.shotsOffTarget.a).toBe(stats.shots.a - stats.shotsOnTarget.a);
  expect(stats.shotsOffTarget.b).toBe(stats.shots.b - stats.shotsOnTarget.b);

  // opponentOnTarget = goals + saves
  expect(stats.saves.a).toBe(stats.shotsOnTarget.b - scoreB);
  expect(stats.saves.b).toBe(stats.shotsOnTarget.a - scoreA);

  expect(stats.offsides.a).toBeLessThanOrEqual(2);
  expect(stats.offsides.b).toBeLessThanOrEqual(2);
  expect(stats.offsides.a).toBeGreaterThanOrEqual(0);
  expect(stats.offsides.b).toBeGreaterThanOrEqual(0);
}

describe('getMatchStatsIntervalBucket', () => {
  const kickoffIso = jerusalemDateTime('2026-07-10', '17:00').toISOString();

  it('returns -1 before kickoff', () => {
    expect(getMatchStatsIntervalBucket(kickoffIso, jerusalemDateTime('2026-07-10', '16:30'))).toBe(
      -1
    );
  });

  it('returns 0 in the first 10 minutes', () => {
    expect(getMatchStatsIntervalBucket(kickoffIso, jerusalemDateTime('2026-07-10', '17:05'))).toBe(
      0
    );
  });

  it('returns 2 around minute 25', () => {
    expect(getMatchStatsIntervalBucket(kickoffIso, jerusalemDateTime('2026-07-10', '17:25'))).toBe(
      2
    );
  });

  it('locks to max bucket when finished', () => {
    expect(getMatchStatsIntervalBucket(kickoffIso, jerusalemDateTime('2026-07-10', '18:05'))).toBe(
      MATCH_STATS_MAX_BUCKET
    );
  });

  it('returns -1 for technical winner (no fabricated stats)', () => {
    expect(
      getMatchStatsIntervalBucket(kickoffIso, jerusalemDateTime('2026-07-10', '16:00'), 3)
    ).toBe(-1);
    expect(
      getMatchStatsIntervalBucket(kickoffIso, jerusalemDateTime('2026-07-10', '18:05'), 3)
    ).toBe(-1);
  });
});
describe('generateMatchStats', () => {
  it('is deterministic for the same seed', () => {
    const a = generateMatchStats(2, 1, 42);
    const b = generateMatchStats(2, 1, 42);
    expect(a).toEqual(b);
  });

  it('changes when seed changes', () => {
    const a = generateMatchStats(2, 1, 1);
    const b = generateMatchStats(2, 1, 2);
    expect(a).not.toEqual(b);
  });

  it('keeps invariants for draws and blowouts', () => {
    for (const [sa, sb, seed] of [
      [0, 0, 10],
      [1, 1, 11],
      [3, 2, 12],
      [9, 1, 13],
      [0, 4, 14],
    ] as const) {
      assertSideInvariants(generateMatchStats(sa, sb, seed), sa, sb);
    }
  });

  it('caps possession near 68/32 even on a huge scoreline', () => {
    const stats = generateMatchStats(9, 1, 99);
    expect(stats.possession.a).toBeLessThanOrEqual(68);
    expect(stats.possession.b).toBeGreaterThanOrEqual(32);
  });

  it('gives the winning side at least ~56% possession', () => {
    for (const seed of [1, 2, 3, 7, 42, 99]) {
      const stats = generateMatchStats(2, 1, seed);
      expect(stats.possession.a).toBeGreaterThanOrEqual(56);
      expect(stats.possession.b).toBeLessThanOrEqual(44);
    }
  });

  it('keeps saves equal to opponent on-target minus goals across buckets', () => {
    const seed = hashMatchStatsSeed(7, 0);
    for (let bucket = 0; bucket <= MATCH_STATS_MAX_BUCKET; bucket++) {
      const stats = generateMatchStats(3, 1, seed, { bucket });
      expect(stats.saves.a).toBe(stats.shotsOnTarget.b - 1);
      expect(stats.saves.b).toBe(stats.shotsOnTarget.a - 3);
    }
  });

  it('keeps rolled saves stable when the live scoreline changes', () => {
    const seed = hashMatchStatsSeed(99, 1);
    const low = generateMatchStats(1, 0, seed);
    const high = generateMatchStats(4, 2, seed);
    expect(low.saves).toEqual(high.saves);
    expect(high.shotsOnTarget.a).toBe(4 + high.saves.b);
    expect(high.shotsOnTarget.b).toBe(2 + high.saves.a);
  });

  it('keeps corners/fouls/offsides stable across scorelines (score-stable template)', () => {
    const seed = hashMatchStatsSeed(55, 0);
    const low = generateMatchStats(0, 0, seed);
    const high = generateMatchStats(5, 3, seed);
    expect(low.corners).toEqual(high.corners);
    expect(low.fouls).toEqual(high.fouls);
    expect(low.offsides).toEqual(high.offsides);
  });

  it('grows count stats monotonically across buckets', () => {
    const seed = hashMatchStatsSeed(7, 0);
    const keys: (keyof MatchStatistics)[] = [
      'shots',
      'shotsOnTarget',
      'corners',
      'fouls',
      'offsides',
      'saves',
    ];
    let prev: MatchStatistics | null = null;
    for (let bucket = 0; bucket <= MATCH_STATS_MAX_BUCKET; bucket++) {
      // Use fixed seed so full draw is stable; bucket only scales
      const stats = generateMatchStats(2, 1, seed, { bucket });
      assertSideInvariants(stats, 2, 1);
      if (prev) {
        for (const key of keys) {
          const p = prev[key] as SidePair;
          const c = stats[key] as SidePair;
          expect(c.a).toBeGreaterThanOrEqual(p.a);
          expect(c.b).toBeGreaterThanOrEqual(p.b);
        }
      }
      prev = stats;
    }
  });

  it('applies mild season bias without breaking invariants', () => {
    const stats = generateMatchStats(1, 1, 50, {
      bias: {
        a: { gd: 8, points: 12, played: 4 },
        b: { gd: -5, points: 1, played: 4 },
      },
    });
    assertSideInvariants(stats, 1, 1);
  });
});

describe('estimateWinChance', () => {
  it('sums to 100 and favors the stronger side', () => {
    const chance = estimateWinChance(
      { gd: 6, points: 9, played: 3 },
      { gd: -4, points: 1, played: 3 },
      ['W', 'W', 'D'],
      ['L', 'L', 'D']
    );
    expect(chance.a + chance.b).toBe(100);
    expect(chance.a).toBeGreaterThan(chance.b);
  });
});
