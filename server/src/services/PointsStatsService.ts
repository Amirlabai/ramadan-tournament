import { Division } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { SeasonService } from './SeasonService';

export interface PointsStandingsEntry {
  teamId: number;
  teamName: string;
  logoUrl?: string;
  totalPoints: number;
}

export class PointsStatsService {
  static async calculatePointsStandings(seasonId?: string): Promise<PointsStandingsEntry[]> {
    const season = seasonId
      ? await prisma.season.findUniqueOrThrow({ where: { id: seasonId } })
      : await SeasonService.getActiveSeason(Division.girls);

    const cacheKey = CacheService.key('doc', Division.girls, 'stats', 'points', season.id);

    return CacheService.getOrSet(cacheKey, 60, async () => {
      const [teams, aggregates] = await Promise.all([
        prisma.team.findMany({
          where: { seasonId: season.id },
          orderBy: { id: 'asc' },
        }),
        prisma.pointEntry.groupBy({
          by: ['teamId'],
          where: { seasonId: season.id },
          _sum: { points: true },
        }),
      ]);

      const pointsByTeam = new Map(
        aggregates.map((a) => [a.teamId, a._sum.points ?? 0])
      );

      return teams
        .map((t) => ({
          teamId: t.id,
          teamName: t.name,
          logoUrl: t.logoUrl ?? undefined,
          totalPoints: pointsByTeam.get(t.id) ?? 0,
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);
    });
  }
}
