import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { SeasonService } from './SeasonService';

function formatMatch(match: any) {
  return {
    id: match.id,
    date: match.date,
    location: match.location,
    phase: match.phase,
    team1Id: match.team1Id,
    team2Id: match.team2Id,
    score1: match.score1,
    score2: match.score2,
    technicalWinnerTeamId: match.technicalWinnerTeamId ?? null,
    goals: match.goals.map((g: any) => ({
      memberId: g.memberId ?? null,
      minute: g.minute,
      isOwnGoal: g.isOwnGoal === true,
      creditedTeamId: g.creditedTeamId ?? null,
    })),
    commentCount: match._count?.comments ?? 0,
  };
}

export class MatchDataService {
  static async getMatchById(matchId: number) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        goals: true,
        _count: { select: { comments: true } },
      },
    });
    if (!match) return null;
    return {
      ...formatMatch(match),
      seasonId: match.seasonId,
    };
  }

  static async getAllMatchesDocument() {
    const season = await SeasonService.getActiveFootballSeason();
    const cacheKey = CacheService.key('doc', 'boys', 'matches', 'all', season.id);

    return CacheService.getOrSet(cacheKey, 60, async () => {
      const matches = await prisma.match.findMany({
        where: { seasonId: season.id },
        include: {
          goals: true,
          _count: { select: { comments: true } },
        },
        orderBy: { date: 'desc' },
      });
      return matches.map(formatMatch);
    });
  }
}
