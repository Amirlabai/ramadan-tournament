import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';

export interface ISeasonArchive {
  seasonId?: string;
  yearMonth: string;
  division?: string;
  displayName: string;
  winner: {
    teamId: number;
    name: string;
    logoUrl?: string;
  };
  topScorer: {
    memberId: number;
    name: string;
    teamName: string;
    goals: number;
  };
  mvp?: {
    memberId: number;
    name: string;
    teamName: string;
  };
  standings: unknown[];
  topScorers: unknown[];
  playoffs?: unknown[];
  summary?: string;
  createdAt: Date;
}

function mapRow(row: {
  seasonId: string;
  yearMonth: string;
  division: string;
  displayName: string;
  winner: unknown;
  topScorer: unknown;
  mvp: unknown | null;
  standings: unknown;
  topScorers: unknown;
  playoffs: unknown;
  summary: string | null;
  createdAt: Date;
}): ISeasonArchive {
  return {
    seasonId: row.seasonId,
    yearMonth: row.yearMonth,
    division: row.division,
    displayName: row.displayName,
    winner: row.winner as ISeasonArchive['winner'],
    topScorer: row.topScorer as ISeasonArchive['topScorer'],
    mvp: (row.mvp as ISeasonArchive['mvp']) ?? undefined,
    standings: row.standings as unknown[],
    topScorers: row.topScorers as unknown[],
    playoffs: row.playoffs as unknown[],
    summary: row.summary ?? undefined,
    createdAt: row.createdAt,
  };
}

export const SeasonArchive = {
  find() {
    return {
      select(_fields: string) {
        return this;
      },
      sort(_sort: { yearMonth: -1 }) {
        return this;
      },
      async then(resolve: (v: ISeasonArchive[]) => void, reject?: (e: unknown) => void) {
        try {
          const rows = await prisma.seasonArchive.findMany({
            orderBy: { yearMonth: 'desc' },
          });
          resolve(rows.map(mapRow));
        } catch (e) {
          reject?.(e);
        }
      },
    };
  },

  async findOne(filter: { yearMonth: string }) {
    const row = await prisma.seasonArchive.findFirst({
      where: { yearMonth: filter.yearMonth },
    });
    return row ? mapRow(row) : null;
  },

  async findOneAndUpdate(
    filter: { yearMonth: string },
    body: Partial<ISeasonArchive>,
    opts?: { upsert?: boolean }
  ) {
    const season = await SeasonService.getActiveFootballSeason();
    const existing = await prisma.seasonArchive.findFirst({
      where: { yearMonth: filter.yearMonth, division: 'boys' },
    });
    const data = {
      yearMonth: filter.yearMonth,
      division: 'boys' as const,
      displayName: body.displayName || existing?.displayName || filter.yearMonth,
      winner: (body.winner ?? existing?.winner ?? {}) as object,
      topScorer: (body.topScorer ?? existing?.topScorer ?? {}) as object,
      mvp: (body.mvp ?? existing?.mvp ?? undefined) as object | undefined,
      standings: (body.standings ?? existing?.standings ?? []) as object,
      topScorers: (body.topScorers ?? existing?.topScorers ?? []) as object,
      playoffs: (body.playoffs ?? existing?.playoffs ?? []) as object,
      summary: body.summary ?? existing?.summary,
    };
    if (existing) {
      const updated = await prisma.seasonArchive.update({
        where: { seasonId: existing.seasonId },
        data,
      });
      return mapRow(updated);
    }
    if (!opts?.upsert) return null;
    const created = await prisma.seasonArchive.create({
      data: { seasonId: season.id, ...data },
    });
    return mapRow(created);
  },

  async create(body: Omit<ISeasonArchive, 'createdAt' | 'seasonId'> & { playoffs?: unknown[] }) {
    const season = await SeasonService.getActiveFootballSeason();
    const row = await prisma.seasonArchive.create({
      data: {
        seasonId: season.id,
        yearMonth: body.yearMonth,
        division: 'boys',
        displayName: body.displayName,
        winner: body.winner as object,
        topScorer: body.topScorer as object,
        mvp: body.mvp as object | undefined,
        standings: body.standings as object,
        topScorers: body.topScorers as object,
        playoffs: (body.playoffs || []) as object,
        summary: body.summary,
      },
    });
    return mapRow(row);
  },
};
