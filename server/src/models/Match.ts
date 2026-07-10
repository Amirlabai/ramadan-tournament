import { prisma } from '../lib/prisma';

import { SeasonService } from '../services/SeasonService';

import { CacheService } from '../services/CacheService';



export interface IGoal {

  memberId: number;

  minute: number;

}



export interface IMatch {

  id: number;

  date: Date;

  location: string;

  phase: 'group' | 'knockout';

  team1Id: number;

  team2Id: number;

  score1: number | null;

  score2: number | null;

  goals: IGoal[];

  commentCount?: number;

  save(): Promise<IMatch>;

  toObject(): IMatch;

}



function mapMatch(row: any): IMatch {

  const match: IMatch = {

    id: row.id,

    date: row.date,

    location: row.location,

    phase: row.phase,

    team1Id: row.team1Id,

    team2Id: row.team2Id,

    score1: row.score1,

    score2: row.score2,

    goals: (row.goals || []).map((g: any) => ({ memberId: g.memberId, minute: g.minute ?? 0 })),

    commentCount: row._count?.comments ?? row.commentCount,

    toObject() {

      return { ...match, goals: [...match.goals] };

    },

    async save() {

      const season = await SeasonService.getActiveFootballSeason();

      await prisma.$transaction(async (tx) => {

        await tx.goal.deleteMany({ where: { seasonId: season.id, matchId: match.id } });

        if (match.goals.length) {

          await tx.goal.createMany({

            data: match.goals.map((g) => ({

              seasonId: season.id,

              matchId: match.id,

              memberId: g.memberId,

              minute: g.minute,

            })),

          });

        }

        await tx.match.update({

          where: { seasonId_id: { seasonId: season.id, id: match.id } },

          data: {

            date: match.date,

            location: match.location,

            phase: match.phase,

            team1Id: match.team1Id,

            team2Id: match.team2Id,

            score1: match.score1,

            score2: match.score2,

          },

        });

      });

      await CacheService.invalidatePattern('rt:doc:boys:*');

      return match;

    },

  };

  return match;

}



type FindFilter = {

  id?: number;

  phase?: string;

  date?: { $gte?: Date; $lte?: Date };

  score1?: { $ne?: null };

  $or?: Array<{ score1?: null; score2?: null }>;

};



async function loadMatches(where: FindFilter, orderBy?: { id?: 'asc' | 'desc'; date?: 'asc' | 'desc' }, limit?: number): Promise<IMatch[]> {

  const season = await SeasonService.getActiveFootballSeason();

  const prismaWhere: Record<string, unknown> = { seasonId: season.id };

  if (where.id !== undefined) prismaWhere.id = where.id;

  if (where.phase) prismaWhere.phase = where.phase;

  if (where.date?.$gte || where.date?.$lte) {

    prismaWhere.date = {

      ...(where.date.$gte ? { gte: where.date.$gte } : {}),

      ...(where.date.$lte ? { lte: where.date.$lte } : {}),

    };

  }

  if (where.score1?.$ne !== undefined) {

    prismaWhere.score1 = { not: null };

  }

  if (where.$or) {

    prismaWhere.OR = where.$or.map((clause) => {

      if (clause.score1 === null) return { score1: null };

      if (clause.score2 === null) return { score2: null };

      return {};

    });

  }

  const rows = await prisma.match.findMany({

    where: prismaWhere as any,

    include: { goals: true, _count: { select: { comments: true } } },

    orderBy: orderBy?.date ? { date: orderBy.date } : orderBy?.id ? { id: orderBy.id } : undefined,

    take: limit,

  });

  return rows.map(mapMatch);

}



export class Match {

  id?: number;

  date?: Date;

  location?: string;

  phase?: 'group' | 'knockout';

  team1Id?: number;

  team2Id?: number;

  score1?: number | null;

  score2?: number | null;

  goals: IGoal[] = [];

  createdBy?: string;



  constructor(data: Partial<IMatch> & { createdBy?: string }) {

    Object.assign(this, data);

  }



  toObject(): IMatch {

    return mapMatch(this);

  }



  async save(): Promise<IMatch> {

    const season = await SeasonService.getActiveFootballSeason();

    const created = await prisma.match.create({

      data: {

        id: this.id!,

        seasonId: season.id,

        date: this.date!,

        location: this.location!,

        phase: (this.phase as any) || 'group',

        team1Id: this.team1Id!,

        team2Id: this.team2Id!,

        score1: this.score1 ?? null,

        score2: this.score2 ?? null,

        createdById: this.createdBy,

        goals: {

          create: this.goals.map((g) => ({

            seasonId: season.id,

            memberId: g.memberId,

            minute: g.minute,

          })),

        },

      },

      include: { goals: true },

    });

    await CacheService.invalidatePattern('rt:doc:boys:*');

    return mapMatch(created);

  }



  static create(data: Partial<IMatch> & { createdBy?: string }) {

    return new Match(data).save();

  }



  static find(filter: FindFilter = {}) {

    let sortOpt: { id?: 1 | -1; date?: 1 | -1 } | undefined;

    let limitN: number | undefined;

    const c = {

      sort(sort: { id?: 1 | -1; date?: 1 | -1 }) {

        sortOpt = sort;

        return c;

      },

      limit(n: number) {

        limitN = n;

        return c;

      },

      async then(resolve: (v: IMatch[]) => void, reject?: (e: unknown) => void) {

        try {

          const orderBy = sortOpt?.date

            ? { date: (sortOpt.date === 1 ? 'asc' : 'desc') as 'asc' | 'desc' }

            : sortOpt?.id

              ? { id: (sortOpt.id === 1 ? 'asc' : 'desc') as 'asc' | 'desc' }

              : undefined;

          resolve(await loadMatches(filter, orderBy, limitN));

        } catch (e) {

          reject?.(e);

        }

      },

    };

    return c;

  }



  static findOne(filter: FindFilter = {}) {

    let sortOpt: { id?: 1 | -1; date?: 1 | -1 } | undefined;

    const c = {

      sort(sort: { id?: 1 | -1; date?: 1 | -1 }) {

        sortOpt = sort;

        return c;

      },

      select(_fields: string) {

        return c;

      },

      async then(resolve: (v: IMatch | null) => void, reject?: (e: unknown) => void) {

        try {

          const orderBy = sortOpt?.date

            ? { date: (sortOpt.date === 1 ? 'asc' : 'desc') as 'asc' | 'desc' }

            : sortOpt?.id

              ? { id: (sortOpt.id === 1 ? 'asc' : 'desc') as 'asc' | 'desc' }

              : undefined;

          const rows = await loadMatches(filter, orderBy, 1);

          resolve(rows[0] ?? null);

        } catch (e) {

          reject?.(e);

        }

      },

    };

    return c;

  }



  static async findOneAndUpdate(

    filter: { id: number },

    body: Partial<IMatch>,

    opts?: { new?: boolean; upsert?: boolean }

  ): Promise<IMatch | null> {

    const existing = await Match.findOne({ id: filter.id });

    if (!existing) {

      if (!opts?.upsert) return null;

      const created = new Match({

        ...body,

        id: filter.id,

        goals: body.goals ?? [],

      });

      return created.save();

    }

    if (body.date !== undefined) existing.date = body.date instanceof Date ? body.date : new Date(body.date);

    if (body.location !== undefined) existing.location = body.location;

    if (body.phase !== undefined) existing.phase = body.phase;

    if (body.team1Id !== undefined) existing.team1Id = body.team1Id;

    if (body.team2Id !== undefined) existing.team2Id = body.team2Id;

    if (body.score1 !== undefined) existing.score1 = body.score1;

    if (body.score2 !== undefined) existing.score2 = body.score2;

    if (body.goals !== undefined) existing.goals = body.goals;

    return existing.save();

  }



  static async findOneAndDelete(filter: { id: number }) {

    const season = await SeasonService.getActiveFootballSeason();

    const row = await prisma.match.delete({

      where: { seasonId_id: { seasonId: season.id, id: filter.id } },

      include: { goals: true },

    });

    await CacheService.invalidatePattern('rt:doc:boys:*');

    return mapMatch(row);

  }



  static async countDocuments(filter: FindFilter = {}) {

    const season = await SeasonService.getActiveFootballSeason();

    const prismaWhere: Record<string, unknown> = { seasonId: season.id };

    if (filter.phase) prismaWhere.phase = filter.phase;

    if (filter.$or) {

      prismaWhere.OR = filter.$or.map((clause) => {

        if (clause.score1 === null) return { score1: null };

        if (clause.score2 === null) return { score2: null };

        return {};

      });

    }

    return prisma.match.count({ where: prismaWhere as any });

  }



  static async aggregate(pipeline: Record<string, unknown>[]) {

    const season = await SeasonService.getActiveFootballSeason();

    let where: Record<string, unknown> = { seasonId: season.id };

    let orderBy: { date?: 'asc' | 'desc'; id?: 'asc' | 'desc' } | undefined;

    let limit: number | undefined;

    let withComments = false;

    let scoreNotNull = false;



    for (const stage of pipeline) {

      if (stage.$match) {

        const m = stage.$match as Record<string, unknown>;

        if (m.date && typeof m.date === 'object') {

          const d = m.date as { $gte?: Date; $lte?: Date };

          where.date = {

            ...(d.$gte ? { gte: d.$gte } : {}),

            ...(d.$lte ? { lte: d.$lte } : {}),

          };

        }

        if ((m.score1 as { $ne?: null })?.$ne !== undefined) {

          scoreNotNull = true;

        }

      }

      if (stage.$sort) {

        const s = stage.$sort as { date?: -1 | 1; id?: -1 | 1 };

        if (s.date) orderBy = { date: s.date === 1 ? 'asc' : 'desc' };

        if (s.id) orderBy = { id: s.id === 1 ? 'asc' : 'desc' };

      }

      if (stage.$limit) limit = stage.$limit as number;

      if (stage.$lookup) withComments = true;

    }



    if (scoreNotNull) where.score1 = { not: null };



    const rows = await prisma.match.findMany({

      where: where as any,

      include: {

        goals: true,

        ...(withComments ? { _count: { select: { comments: true } } } : {}),

      },

      orderBy: orderBy || { date: 'desc' },

      take: limit,

    });



    return rows.map((row) => {

      const m = mapMatch(row);

      if (withComments) {

        return { ...m, commentCount: (row as any)._count?.comments ?? 0 };

      }

      return m;

    });

  }



  static async insertMany(docs: Array<Partial<IMatch>>) {

    const season = await SeasonService.getActiveFootballSeason();

    for (const doc of docs) {

      await prisma.match.create({

        data: {

          id: doc.id!,

          seasonId: season.id,

          date: doc.date!,

          location: doc.location!,

          phase: (doc.phase as any) || 'group',

          team1Id: doc.team1Id!,

          team2Id: doc.team2Id!,

          score1: doc.score1 ?? null,

          score2: doc.score2 ?? null,

        },

      });

    }

    await CacheService.invalidatePattern('rt:doc:boys:*');

  }



  static async deleteMany() {

    const season = await SeasonService.getActiveFootballSeason();

    await prisma.match.deleteMany({ where: { seasonId: season.id } });

  }

}


