import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';
import type { IMatch } from '../models/Match';

type MatchListOptions = {
  phase?: 'group' | 'knockout';
  dateFrom?: Date;
  dateTo?: Date;
  finishedOnly?: boolean;
  sortField?: 'date' | 'id';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  includeCommentCount?: boolean;
};

function mapRow(row: any): IMatch & { commentCount?: number } {
  return {
    id: row.id,
    date: row.date,
    location: row.location,
    phase: row.phase,
    team1Id: row.team1Id,
    team2Id: row.team2Id,
    score1: row.score1,
    score2: row.score2,
    goals: (row.goals || []).map((g: any) => ({ memberId: g.memberId, minute: g.minute ?? 0 })),
    commentCount: row._count?.comments,
    toObject() {
      return { ...this, goals: [...this.goals] };
    },
    async save() {
      throw new Error('Use Match model save()');
    },
  };
}

export async function listMatches(options: MatchListOptions = {}): Promise<Array<IMatch & { commentCount?: number }>> {
  const season = await SeasonService.getActiveFootballSeason();
  const where: Record<string, unknown> = { seasonId: season.id };

  if (options.phase) where.phase = options.phase;
  if (options.dateFrom || options.dateTo) {
    where.date = {
      ...(options.dateFrom ? { gte: options.dateFrom } : {}),
      ...(options.dateTo ? { lte: options.dateTo } : {}),
    };
  }
  if (options.finishedOnly) where.score1 = { not: null };

  const orderField = options.sortField ?? 'date';
  const orderDirection = options.sortDirection ?? 'desc';

  const rows = await prisma.match.findMany({
    where: where as any,
    include: {
      goals: true,
      ...(options.includeCommentCount ? { _count: { select: { comments: true } } } : {}),
    },
    orderBy: { [orderField]: orderDirection },
    take: options.limit,
  });

  return rows.map(mapRow);
}

export async function findNextUpcomingMatchDate(): Promise<Date | null> {
  const season = await SeasonService.getActiveFootballSeason();
  const row = await prisma.match.findFirst({
    where: { seasonId: season.id, date: { gte: new Date() } },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  return row?.date ?? null;
}

export async function countUnplayedGroupMatches(): Promise<number> {
  const season = await SeasonService.getActiveFootballSeason();
  return prisma.match.count({
    where: {
      seasonId: season.id,
      phase: 'group',
      OR: [{ score1: null }, { score2: null }],
    },
  });
}
