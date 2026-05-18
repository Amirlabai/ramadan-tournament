import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';

export class Vote {
  _id?: string;
  id?: string;
  userId?: string;
  playerMemberId?: number | null;
  teamId?: number | null;
  category?: string;
  createdAt?: Date;

  constructor(data: Partial<Vote> & { id?: string; createdAt?: Date }) {
    Object.assign(this, data);
    if (data.id) this._id = data.id;
  }

  async save() {
    const season = await SeasonService.getActiveFootballSeason();
    if (this.id || this._id) {
      const updated = await prisma.vote.update({
        where: { id: (this.id || this._id)! },
        data: { playerMemberId: this.playerMemberId, teamId: this.teamId },
      });
      Object.assign(this, updated);
      this._id = updated.id;
      return this;
    }
    const created = await prisma.vote.create({
      data: {
        userId: this.userId!,
        seasonId: season.id,
        category: this.category || 'mvp',
        playerMemberId: this.playerMemberId,
        teamId: this.teamId,
      },
    });
    Object.assign(this, created);
    this._id = created.id;
    this.createdAt = new Date();
    return this;
  }

  static async findOne(filter: { userId?: string; category?: string }) {
    const season = await SeasonService.getActiveFootballSeason();
    const row = await prisma.vote.findUnique({
      where: {
        userId_seasonId_category: {
          userId: filter.userId!,
          seasonId: season.id,
          category: filter.category || 'mvp',
        },
      },
    });
    if (!row) return null;
    return new Vote(row as unknown as Partial<Vote>);
  }

  static async find(filter: { category?: string } = {}) {
    const season = await SeasonService.getActiveFootballSeason();
    return prisma.vote.findMany({
      where: {
        seasonId: season.id,
        ...(filter.category ? { category: filter.category } : {}),
      },
    });
  }

  static async deleteOne(filter: { _id?: string; id?: string }) {
    const id = filter._id || filter.id;
    if (id) await prisma.vote.delete({ where: { id } });
  }

  static async deleteMany(filter: { seasonId?: string } = {}) {
    if (filter.seasonId) {
      await prisma.vote.deleteMany({ where: { seasonId: filter.seasonId } });
    }
  }

  static async aggregate(pipeline: Record<string, unknown>[]) {
    const season = await SeasonService.getActiveFootballSeason();
    let category = 'mvp';
    for (const stage of pipeline) {
      if (stage.$match && (stage.$match as { category?: string }).category) {
        category = (stage.$match as { category: string }).category;
      }
    }
    const votes = await prisma.vote.findMany({
      where: { seasonId: season.id, category, playerMemberId: { not: null } },
    });
    const counts = new Map<number, number>();
    for (const v of votes) {
      if (v.playerMemberId == null) continue;
      counts.set(v.playerMemberId, (counts.get(v.playerMemberId) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([_id, votes]) => ({ _id, votes }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10);
  }
}
