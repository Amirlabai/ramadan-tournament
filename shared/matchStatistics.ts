import { getMatchDisplayStatus } from './matchTiming';

export const MATCH_STATS_INTERVAL_MS = 10 * 60 * 1000;
/** Live window has 6 buckets (0..5); finished locks to 5. */
export const MATCH_STATS_MAX_BUCKET = 5;

export type SidePair = { a: number; b: number };

export type TeamBias = {
  gd: number;
  points: number;
  played: number;
};

export type FormResult = 'W' | 'D' | 'L';

/** Rough pre-match win split from season strength + recent form. Sums to 100. */
export function estimateWinChance(
  biasA: TeamBias,
  biasB: TeamBias,
  formA: FormResult[] = [],
  formB: FormResult[] = []
): SidePair {
  if (biasA.played <= 0 && biasB.played <= 0 && formA.length === 0 && formB.length === 0) {
    return { a: 50, b: 50 };
  }

  const strength = (bias: TeamBias, form: FormResult[]): number => {
    const ppg = bias.played > 0 ? bias.points / bias.played : 1;
    const gdp = bias.played > 0 ? bias.gd / bias.played : 0;
    const formPts = form.reduce((sum, r) => sum + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
    const formAvg = form.length > 0 ? formPts / form.length : 1;
    return ppg * 2.2 + gdp * 0.9 + formAvg;
  };

  const sa = strength(biasA, formA);
  const sb = strength(biasB, formB);
  const aPct = clamp(Math.round(50 + (sa - sb) * 9), 22, 78);
  return { a: aPct, b: 100 - aPct };
}

export type MatchStatistics = {
  possession: SidePair;
  shots: SidePair;
  shotsOnTarget: SidePair;
  shotsOffTarget: SidePair;
  corners: SidePair;
  fouls: SidePair;
  offsides: SidePair;
  saves: SidePair;
};

/** Zeroed/neutral stats for upcoming odds-only responses (no fabricated live buckets). */
export const EMPTY_MATCH_STATISTICS: MatchStatistics = {
  possession: { a: 50, b: 50 },
  shots: { a: 0, b: 0 },
  shotsOnTarget: { a: 0, b: 0 },
  shotsOffTarget: { a: 0, b: 0 },
  corners: { a: 0, b: 0 },
  fouls: { a: 0, b: 0 },
  offsides: { a: 0, b: 0 },
  saves: { a: 0, b: 0 },
};

export type GenerateMatchStatsOptions = {
  /** 0..5; scales count stats toward full-match totals (monotonic). */
  bucket?: number;
  bias?: { a: TeamBias; b: TeamBias };
};

/** Mulberry32 — deterministic float in [0, 1). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed from match + regen salt only; bucket scales counts, not the RNG draw. */
export function hashMatchStatsSeed(matchId: number, regenSalt: number): number {
  let h = (matchId | 0) ^ ((regenSalt | 0) * 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * 10-min interval index during the live window.
 * Upcoming or technical win → -1 (no fabricated stats).
 * Finished → MATCH_STATS_MAX_BUCKET.
 */
export function getMatchStatsIntervalBucket(
  kickoffIso: string,
  now: Date = new Date(),
  technicalWinnerTeamId?: number | null
): number {
  if (technicalWinnerTeamId != null) return -1;

  const status = getMatchDisplayStatus(kickoffIso, now, technicalWinnerTeamId);
  if (status === 'upcoming') return -1;
  if (status === 'finished') return MATCH_STATS_MAX_BUCKET;

  const kickoff = new Date(kickoffIso).getTime();
  if (!Number.isFinite(kickoff)) return -1;
  const elapsed = now.getTime() - kickoff;
  if (elapsed < 0) return -1;
  return Math.min(MATCH_STATS_MAX_BUCKET, Math.floor(elapsed / MATCH_STATS_INTERVAL_MS));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function randInt(rng: () => number, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

function biasNudge(bias: TeamBias | undefined): number {
  if (!bias || bias.played <= 0) return 0;
  const raw = bias.gd * 0.35 + bias.points * 0.15;
  return clamp(Math.round(raw), -2, 2);
}

function scaleCount(full: number, bucket: number): number {
  const b = clamp(bucket, 0, MATCH_STATS_MAX_BUCKET);
  const factor = (b + 1) / (MATCH_STATS_MAX_BUCKET + 1);
  return Math.floor(full * factor);
}

function scaleSide(full: SidePair, bucket: number): SidePair {
  return { a: scaleCount(full.a, bucket), b: scaleCount(full.b, bucket) };
}

/**
 * Score-agnostic RNG draw (fixed call order / always 0-0 branches for rolls).
 * Live scoreline is applied afterward without re-rolling.
 */
function generateTemplateStats(
  rng: () => number,
  bias?: { a: TeamBias; b: TeamBias }
): MatchStatistics {
  const nudgeA = biasNudge(bias?.a);
  const nudgeB = biasNudge(bias?.b);
  const strengthDelta = clamp(nudgeA - nudgeB, -4, 4);

  // Fixed RNG consumption — never depends on live score.
  const swing = randInt(rng, 0, 4);
  const winnerJitter = randInt(rng, -1, 3);
  const coin = rng();
  const savesForA = randInt(rng, 0, 4);
  const savesForB = randInt(rng, 0, 4);
  const offA = randInt(rng, 0, 6);
  const offB = randInt(rng, 0, 6);
  const cornerJitterA = randInt(rng, -1, 2);
  const cornerJitterB = randInt(rng, -1, 2);
  const foulRollA = randInt(rng, 0, 6);
  const foulRollB = randInt(rng, 0, 6);
  const offsideRollA = rng();
  const offsideRollB = rng();
  const offsideRollA2 = rng();
  const offsideRollB2 = rng();

  // Template possession from strength only (draw-like); live score nudges later.
  const swingSigned = swing + Math.round(strengthDelta * 0.4);
  let possA = clamp(50 + (coin < 0.5 ? swingSigned : -swingSigned), 46, 54);
  // Fold unused winnerJitter into mild strength lean so the roll isn't wasted.
  possA = clamp(possA + Math.round(strengthDelta * 0.3) + Math.sign(winnerJitter), 42, 58);
  const possession = { a: possA, b: 100 - possA };

  const onA = savesForB; // goals applied later
  const onB = savesForA;
  const shotBiasA = clamp(Math.round(strengthDelta * 0.4), -2, 2);
  const shotsA = Math.max(onA + offA + shotBiasA, onA);
  const shotsB = Math.max(onB + offB - shotBiasA, onB);

  const cornerBaseA = Math.max(1, Math.round(shotsA * 0.45 + possession.a * 0.04));
  const cornerBaseB = Math.max(1, Math.round(shotsB * 0.45 + possession.b * 0.04));
  const corners = {
    a: clamp(cornerBaseA + cornerJitterA + (nudgeA > nudgeB ? 1 : 0), 0, 14),
    b: clamp(cornerBaseB + cornerJitterB + (nudgeB > nudgeA ? 1 : 0), 0, 14),
  };

  const fouls = {
    a: clamp(8 + foulRollA + (nudgeA < nudgeB ? 1 : 0), 4, 22),
    b: clamp(8 + foulRollB + (nudgeB < nudgeA ? 1 : 0), 4, 22),
  };

  const offsides = {
    a: clamp(offsideRollA < 0.55 ? 0 : offsideRollA2 < 0.85 ? 1 : 2, 0, 2),
    b: clamp(offsideRollB < 0.55 ? 0 : offsideRollB2 < 0.85 ? 1 : 2, 0, 2),
  };

  return {
    possession,
    shots: { a: shotsA, b: shotsB },
    shotsOnTarget: { a: onA, b: onB },
    shotsOffTarget: { a: shotsA - onA, b: shotsB - onB },
    corners,
    fouls,
    offsides,
    saves: { a: savesForA, b: savesForB },
  };
}

/** Apply live score: keep rolled saves; onTarget = goals + saves; nudge possession by GD. */
function applyLiveScoreline(
  template: MatchStatistics,
  goalsA: number,
  goalsB: number
): MatchStatistics {
  const saves = template.saves;
  const onA = goalsA + saves.b;
  const onB = goalsB + saves.a;
  const shotsA = Math.max(template.shots.a, onA);
  const shotsB = Math.max(template.shots.b, onB);

  const diff = Math.abs(goalsA - goalsB);
  let possA = template.possession.a;
  if (goalsA !== goalsB) {
    const lean = Math.min(12, 6 + diff * 2);
    possA = goalsA > goalsB
      ? clamp(Math.max(possA, 50 + lean / 2), 56, 68)
      : clamp(Math.min(possA, 50 - lean / 2), 32, 44);
  }

  return {
    ...template,
    possession: { a: possA, b: 100 - possA },
    shots: { a: shotsA, b: shotsB },
    shotsOnTarget: { a: onA, b: onB },
    shotsOffTarget: { a: shotsA - onA, b: shotsB - onB },
    saves,
  };
}

/**
 * Fabricated match stats from scoreline (+ optional season bias).
 * Full RNG template is score-stable; live goals only re-clamp identity.
 */
export function generateMatchStats(
  scoreA: number,
  scoreB: number,
  seed: number,
  options: GenerateMatchStatsOptions = {}
): MatchStatistics {
  const goalsA = Math.max(0, Math.floor(scoreA));
  const goalsB = Math.max(0, Math.floor(scoreB));
  const bucket = options.bucket ?? MATCH_STATS_MAX_BUCKET;
  const rng = mulberry32(seed >>> 0);
  const template = generateTemplateStats(rng, options.bias);
  const full = applyLiveScoreline(template, goalsA, goalsB);

  if (bucket >= MATCH_STATS_MAX_BUCKET) {
    return full;
  }

  const progress = (bucket + 1) / (MATCH_STATS_MAX_BUCKET + 1);
  const midA = 50;
  const possA = Math.round(midA + (full.possession.a - midA) * progress);
  const possession = { a: clamp(possA, 32, 68), b: 100 - clamp(possA, 32, 68) };

  const shots = scaleSide(full.shots, bucket);
  shots.a = Math.max(shots.a, Math.min(goalsA, full.shots.a));
  shots.b = Math.max(shots.b, Math.min(goalsB, full.shots.b));

  // Scale saves then rebuild on-target from live goals + scaled saves
  const saves = scaleSide(full.saves, bucket);
  const onA = goalsA + saves.b;
  const onB = goalsB + saves.a;
  shots.a = Math.max(shots.a, onA);
  shots.b = Math.max(shots.b, onB);

  return {
    possession,
    shots,
    shotsOnTarget: { a: onA, b: onB },
    shotsOffTarget: { a: shots.a - onA, b: shots.b - onB },
    corners: scaleSide(full.corners, bucket),
    fouls: scaleSide(full.fouls, bucket),
    offsides: scaleSide(full.offsides, bucket),
    saves,
  };
}
