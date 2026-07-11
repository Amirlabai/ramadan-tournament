import { prisma } from '../lib/prisma';
import { MATCH_DURATION_MS } from '@ramadan-tournament/shared';
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
    technicalWinnerTeamId: row.technicalWinnerTeamId ?? null,
    goals: (row.goals || []).map((g: any) => ({
      memberId: g.memberId ?? null,
      minute: g.minute ?? 0,
      isOwnGoal: g.isOwnGoal === true,
      creditedTeamId: g.creditedTeamId ?? null,
    })),
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

  const dateBounds: Record<string, Date> = {};
  if (options.dateFrom) dateBounds.gte = options.dateFrom;
  if (options.dateTo) dateBounds.lte = options.dateTo;
  const hasDateBounds = Object.keys(dateBounds).length > 0;

  if (options.finishedOnly) {
    const kickoffEndedBefore = new Date(Date.now() - MATCH_DURATION_MS);
    where.AND = [
      { score1: { not: null } },
      { score2: { not: null } },
      {
        OR: [
          { date: { ...dateBounds, lt: kickoffEndedBefore } },
          {
            AND: [
              { technicalWinnerTeamId: { not: null } },
              ...(hasDateBounds ? [{ date: dateBounds }] : []),
            ],
          },
        ],
      },
    ];
  } else if (hasDateBounds) {
    where.date = dateBounds;
  }

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

/** Earliest kickoff still in the live window or upcoming — pins that Jerusalem match day on the home feed until the last live match ends (intentional). Technical wins are excluded (always finished). */
export async function findNextUpcomingMatchDate(): Promise<Date | null> {
  const season = await SeasonService.getActiveFootballSeason();
  const liveWindowStart = new Date(Date.now() - MATCH_DURATION_MS);
  const row = await prisma.match.findFirst({
    where: {
      seasonId: season.id,
      date: { gte: liveWindowStart },
      technicalWinnerTeamId: null,
    },
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
