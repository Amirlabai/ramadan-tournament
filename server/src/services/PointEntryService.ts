import { Division } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { PointsStatsService } from './PointsStatsService';

export class PointEntryService {
  static async invalidateGirlsCaches(seasonId: string): Promise<void> {
    await CacheService.del(
      CacheService.key('doc', Division.girls, 'stats', 'points', seasonId),
      CacheService.key('doc', Division.girls, 'teams', 'all', seasonId)
    );
    await CacheService.invalidatePattern(`rt:doc:girls:stats:*`);
  }

  static async recordEntry(
    seasonId: string,
    teamId: number,
    points: number,
    note: string | undefined,
    recordedById: string
  ) {
    const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
    if (season.scoringMode !== 'points') {
      throw new Error('Season is not a points tournament');
    }

    const team = await prisma.team.findFirst({
      where: { seasonId, id: teamId },
    });
    if (!team) {
      throw new Error('Team not found in this season');
    }

    const entry = await prisma.pointEntry.create({
      data: {
        seasonId,
        teamId,
        points,
        note: note?.trim() || null,
        recordedById,
      },
      include: {
        team: { select: { name: true } },
      },
    });

    await this.invalidateGirlsCaches(seasonId);
    const standings = await PointsStatsService.calculatePointsStandings(seasonId);

    return { entry, standings };
  }

  static async listEntries(seasonId: string, limit = 50) {
    return prisma.pointEntry.findMany({
      where: { seasonId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
      include: {
        team: { select: { id: true, name: true } },
        recordedBy: { select: { displayName: true } },
      },
    });
  }
}
