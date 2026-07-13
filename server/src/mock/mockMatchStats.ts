import {
  estimateWinChance,
  generateMatchStats,
  getMatchDisplayStatus,
  getMatchStatsIntervalBucket,
  hashMatchStatsSeed,
} from '@ramadan-tournament/shared';
import { accumulateTeamFormBias } from '../services/matchFormBias';
import type { MatchStatsPayload } from '../services/MatchStatsService';
import { getRegenSalt, setRegenSalt } from '../services/matchStatsSalt';
import { getMockStore } from './dataLoader';

export async function buildMockMatchStatsPayload(
  matchId: number,
  now: Date = new Date()
): Promise<MatchStatsPayload | null> {
  const { matches } = getMockStore();
  const match = matches.find((m) => m.id === matchId);
  if (!match) return null;

  const kickoffIso = match.date.toISOString();
  if (match.technicalWinnerTeamId != null) return null;

  const status = getMatchDisplayStatus(kickoffIso, now, match.technicalWinnerTeamId);
  if (status === 'upcoming') return null;

  const bucket = getMatchStatsIntervalBucket(kickoffIso, now, match.technicalWinnerTeamId);
  if (bucket < 0) return null;

  const prior = matches.filter((m) => m.id !== matchId && m.date.getTime() < match.date.getTime());
  const sideA = accumulateTeamFormBias(prior, match.team1Id, match.date);
  const sideB = accumulateTeamFormBias(prior, match.team2Id, match.date);
  const salt = await getRegenSalt(matchId);
  const seed = hashMatchStatsSeed(matchId, salt);
  const stats = generateMatchStats(match.score1 ?? 0, match.score2 ?? 0, seed, {
    bucket,
    bias: { a: sideA.bias, b: sideB.bias },
  });

  return {
    matchId,
    bucket,
    status,
    stats,
    form: { a: sideA.form, b: sideB.form },
    bias: { a: sideA.bias, b: sideB.bias },
    winChance: estimateWinChance(sideA.bias, sideB.bias, sideA.form, sideB.form),
  };
}

export async function regenerateMockMatchStats(
  matchId: number,
  now: Date = new Date()
): Promise<MatchStatsPayload | null> {
  const { matches } = getMockStore();
  if (!matches.some((m) => m.id === matchId)) return null;
  const salt = (Math.floor(Math.random() * 0x7fffffff) + 1) | 0;
  await setRegenSalt(matchId, salt);
  return buildMockMatchStatsPayload(matchId, now);
}
