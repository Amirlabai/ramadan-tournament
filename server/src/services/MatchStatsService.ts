import {
  generateMatchStats,
  getMatchDisplayStatus,
  getMatchStatsIntervalBucket,
  hashMatchStatsSeed,
  estimateWinChance,
  type FormResult,
  type MatchStatistics,
  type TeamBias,
} from '@ramadan-tournament/shared';
import { prisma } from '../lib/prisma';
import { MatchDataService } from './MatchDataService';
import { accumulateTeamFormBias, type FormBiasMatch } from './matchFormBias';
import { getRegenSalt, setRegenSalt } from './matchStatsSalt';

export type MatchStatsPayload = {
  matchId: number;
  bucket: number;
  status: 'live' | 'finished';
  stats: MatchStatistics;
  form: { a: FormResult[]; b: FormResult[] };
  bias: { a: TeamBias; b: TeamBias };
  winChance: { a: number; b: number };
};

export class MatchStatsService {
  static async getPayload(matchId: number, now: Date = new Date()): Promise<MatchStatsPayload | null> {
    const match = await MatchDataService.getMatchById(matchId);
    if (!match) return null;

    const kickoffIso =
      match.date instanceof Date ? match.date.toISOString() : String(match.date);

    if (match.technicalWinnerTeamId != null) {
      return null;
    }

    const status = getMatchDisplayStatus(
      kickoffIso,
      now,
      match.technicalWinnerTeamId
    );
    if (status === 'upcoming') return null;

    const bucket = getMatchStatsIntervalBucket(
      kickoffIso,
      now,
      match.technicalWinnerTeamId
    );
    if (bucket < 0) return null;

    const score1 = match.score1 ?? 0;
    const score2 = match.score2 ?? 0;
    const matchDate = match.date instanceof Date ? match.date : new Date(match.date);

    const candidates = await prisma.match.findMany({
      where: {
        seasonId: match.seasonId,
        id: { not: matchId },
        date: { lt: matchDate },
        OR: [
          { team1Id: match.team1Id },
          { team2Id: match.team1Id },
          { team1Id: match.team2Id },
          { team2Id: match.team2Id },
        ],
      },
      select: {
        id: true,
        date: true,
        team1Id: true,
        team2Id: true,
        score1: true,
        score2: true,
        technicalWinnerTeamId: true,
      },
    });

    const prior = candidates as FormBiasMatch[];
    const sideA = accumulateTeamFormBias(prior, match.team1Id, matchDate);
    const sideB = accumulateTeamFormBias(prior, match.team2Id, matchDate);

    const salt = await getRegenSalt(matchId);
    const seed = hashMatchStatsSeed(matchId, salt);
    const stats = generateMatchStats(score1, score2, seed, {
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

  static async regenerate(matchId: number, now: Date = new Date()): Promise<MatchStatsPayload | null> {
    const exists = await MatchDataService.getMatchById(matchId);
    if (!exists) return null;
    const salt = (Math.floor(Math.random() * 0x7fffffff) + 1) | 0;
    await setRegenSalt(matchId, salt);
    return this.getPayload(matchId, now);
  }
}
