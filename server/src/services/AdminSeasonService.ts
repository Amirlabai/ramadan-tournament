import { Division, ScoringMode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { PointEntryService } from './PointEntryService';

export class AdminSeasonService {
  static async invalidateActiveSeasonCache(division: Division): Promise<void> {
    await CacheService.del(CacheService.key('season', 'active', division));
  }

  static listSeasons() {
    return prisma.season.findMany({
      orderBy: [{ yearMonth: 'desc' }, { division: 'asc' }],
      include: {
        _count: { select: { teams: true, pointEntries: true } },
      },
    });
  }

  static async getGirlsSeasonSummary() {
    const season = await prisma.season.findFirst({
      where: { division: Division.girls },
      orderBy: { createdAt: 'desc' },
      include: {
        teams: { orderBy: { id: 'asc' } },
        _count: { select: { pointEntries: true } },
      },
    });
    return season;
  }

  static async createGirlsSeason(params: {
    yearMonth: string;
    displayName: string;
    activate?: boolean;
  }) {
    const existing = await prisma.season.findUnique({
      where: {
        yearMonth_division: {
          yearMonth: params.yearMonth,
          division: Division.girls,
        },
      },
    });
    if (existing) {
      throw new Error(`Girls season already exists for ${params.yearMonth}`);
    }

    const activate = params.activate !== false;

    if (activate) {
      await prisma.season.updateMany({
        where: { division: Division.girls, isActive: true },
        data: { isActive: false },
      });
    }

    const season = await prisma.season.create({
      data: {
        yearMonth: params.yearMonth,
        division: Division.girls,
        displayName: params.displayName,
        scoringMode: ScoringMode.points,
        isActive: activate,
      },
    });

    await this.invalidateActiveSeasonCache(Division.girls);
    return season;
  }

  static async activateSeason(seasonId: string) {
    const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });

    await prisma.season.updateMany({
      where: { division: season.division, isActive: true },
      data: { isActive: false },
    });

    const updated = await prisma.season.update({
      where: { id: seasonId },
      data: { isActive: true },
    });

    await this.invalidateActiveSeasonCache(season.division);
    return updated;
  }

  static async addTeam(seasonId: string, name: string) {
    const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
    if (season.scoringMode !== ScoringMode.points) {
      throw new Error('Can only add teams to a points season from this endpoint');
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Team name is required');
    }

    const max = await prisma.team.aggregate({
      where: { seasonId },
      _max: { id: true },
    });
    const nextId = (max._max.id ?? 0) + 1;

    const team = await prisma.team.create({
      data: {
        id: nextId,
        seasonId,
        name: trimmed,
        status: 'active',
      },
    });

    await PointEntryService.invalidateGirlsCaches(seasonId);
    return team;
  }
}
