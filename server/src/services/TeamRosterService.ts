import { Division } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getNextMemberId as getNextGlobalMemberId, invalidateDivisionCaches } from './registrationHelpers';
import { SeasonService } from './SeasonService';
import { encryptPersonalIdIfNeeded, personalIdLookupValues } from '../utils/personalIdCrypto';

async function invalidateTeamSeasonCaches(seasonId: string): Promise<void> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { division: true },
  });
  if (!season) {
    console.warn(`invalidateTeamSeasonCaches: season not found for id ${seasonId}`);
    return;
  }
  await invalidateDivisionCaches(season.division);
}

export interface SaveTeamOptions {
  /** Default true. Set false when batching multiple saves (e.g. movePlayer). */
  invalidateCache?: boolean;
}

export interface IPlayer {
  memberId: number;
  firstName: string;
  lastName: string;
  nickname: string;
  number: number;
  position: string;
  isCaptain: boolean;
  head_photo?: string;
  pending_head_photo?: string;
  bio?: string;
  personalId?: string;
  birthYear?: number;
}

export interface ITeam {
  id: number;
  name: string;
  players: IPlayer[];
  logoUrl?: string;
  logoPosition?: string;
  description?: string;
  seasonId?: string;
}

export interface TeamSummary {
  id: number;
  name: string;
  logoUrl?: string;
  logoPosition?: string;
}

type TeamFilter = Record<string, unknown>;

function mapPlayer(p: {
  memberId: number;
  firstName: string;
  lastName: string;
  nickname: string;
  number: number;
  position: string;
  isCaptain: boolean;
  headPhoto?: string | null;
  pendingHeadPhoto?: string | null;
  bio?: string | null;
  birthYear?: number | null;
}): IPlayer {
  return {
    memberId: p.memberId,
    firstName: p.firstName,
    lastName: p.lastName,
    nickname: p.nickname,
    number: p.number,
    position: p.position,
    isCaptain: p.isCaptain,
    head_photo: p.headPhoto || '',
    pending_head_photo: p.pendingHeadPhoto || '',
    bio: p.bio || '',
    birthYear: p.birthYear ?? undefined,
  };
}

function mapTeam(row: {
  id: number;
  name: string;
  logoUrl?: string | null;
  logoPosition?: string | null;
  description?: string | null;
  seasonId: string;
}, players: Parameters<typeof mapPlayer>[0][]): ITeam {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logoUrl || '',
    logoPosition: row.logoPosition || 'right',
    description: row.description || '',
    seasonId: row.seasonId,
    players: players.map(mapPlayer),
  };
}

async function loadTeams(
  where: Record<string, unknown>,
  sort?: { id?: 1 | -1 },
  division: Division = Division.boys
): Promise<ITeam[]> {
  const season = await SeasonService.getActiveSeason(division);
  const teams = await prisma.team.findMany({
    where: { seasonId: season.id, ...where },
    include: { players: { where: { active: true } } },
    orderBy: sort?.id ? { id: sort.id === 1 ? 'asc' : 'desc' } : undefined,
  });
  return teams.map((t) => mapTeam(t, t.players));
}

async function findTeams(filter: TeamFilter, division: Division = Division.boys): Promise<ITeam[]> {
  const season = await SeasonService.getActiveSeason(division);

  if (filter['players.memberId']) {
    const raw = filter['players.memberId'];
    if (typeof raw === 'object' && raw !== null && '$in' in raw) {
      const ids = (raw as { $in: number[] }).$in;
      const teams = await loadTeams({}, undefined, division);
      return teams.filter((t) => t.players.some((p) => ids.includes(p.memberId)));
    }

    const memberId = raw as number;
    const player = await prisma.player.findFirst({
      where: { seasonId: season.id, memberId },
    });
    if (!player) return [];

    const team = await prisma.team.findFirst({
      where: { seasonId: season.id, id: player.teamId },
      include: { players: { where: { active: true } } },
    });
    return team ? [mapTeam(team, team.players)] : [];
  }

  if (filter.players && typeof filter.players === 'object') {
    const players = filter.players as {
      personalId?: string;
      $elemMatch?: { personalId?: string; birthYear?: number };
    };
    if (players.$elemMatch?.personalId) {
      const lookupValues = personalIdLookupValues(players.$elemMatch.personalId);
      const player = await prisma.player.findFirst({
        where: {
          seasonId: season.id,
          personalIdEnc: { in: lookupValues },
          ...(players.$elemMatch.birthYear !== undefined
            ? { birthYear: players.$elemMatch.birthYear }
            : {}),
        },
      });
      if (!player) return [];
      const team = await prisma.team.findFirst({
        where: { seasonId: season.id, id: player.teamId },
        include: { players: { where: { active: true } } },
      });
      return team ? [mapTeam(team, team.players)] : [];
    }

    const personalId = players.personalId;
    if (personalId) {
      const lookupValues = personalIdLookupValues(personalId);
      const player = await prisma.player.findFirst({
        where: { seasonId: season.id, personalIdEnc: { in: lookupValues } },
      });
      if (!player) return [];
      const team = await prisma.team.findFirst({
        where: { seasonId: season.id, id: player.teamId },
        include: { players: { where: { active: true } } },
      });
      return team ? [mapTeam(team, team.players)] : [];
    }
  }

  if (filter['players.personalId']) {
    const lookupValues = personalIdLookupValues(filter['players.personalId'] as string);
    const player = await prisma.player.findFirst({
      where: { seasonId: season.id, personalIdEnc: { in: lookupValues } },
    });
    if (!player) return [];
    const team = await prisma.team.findFirst({
      where: { seasonId: season.id, id: player.teamId },
      include: { players: { where: { active: true } } },
    });
    return team ? [mapTeam(team, team.players)] : [];
  }

  if (filter.id !== undefined) {
    const team = await prisma.team.findFirst({
      where: { seasonId: season.id, id: filter.id as number },
      include: { players: { where: { active: true } } },
    });
    return team ? [mapTeam(team, team.players)] : [];
  }

  return loadTeams({}, undefined, division);
}

export class TeamRosterService {
  static async findTeamWithPlayers(
    teamId: number,
    division: Division = Division.boys
  ): Promise<ITeam | null> {
    const teams = await findTeams({ id: teamId }, division);
    return teams[0] ?? null;
  }

  static async findTeamWithPlayersById(teamId: number): Promise<ITeam | null> {
    for (const division of [Division.boys, Division.girls]) {
      const team = await this.findTeamWithPlayers(teamId, division);
      if (team) return team;
    }
    return null;
  }

  static async findAllTeamsWithPlayers(division: Division = Division.boys): Promise<ITeam[]> {
    return findTeams({}, division);
  }

  static async listTeamSummaries(division: Division = Division.boys): Promise<TeamSummary[]> {
    const season = await SeasonService.getActiveSeason(division);
    const teams = await prisma.team.findMany({
      where: { seasonId: season.id },
      select: { id: true, name: true, logoUrl: true, logoPosition: true },
      orderBy: { id: 'asc' },
    });
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      logoUrl: t.logoUrl || '',
      logoPosition: t.logoPosition || 'right',
    }));
  }

  static async getNextTeamId(division: Division = Division.boys): Promise<number> {
    const season = await SeasonService.getActiveSeason(division);
    const max = await prisma.team.findFirst({
      where: { seasonId: season.id },
      orderBy: { id: 'desc' },
    });
    return (max?.id ?? 0) + 1;
  }

  static async getNextMemberId(_division?: Division): Promise<number> {
    return getNextGlobalMemberId();
  }

  static async createTeam(
    data: { id?: number; name: string; players?: IPlayer[]; logoUrl?: string; logoPosition?: string },
    division: Division = Division.boys
  ): Promise<ITeam> {
    const season = await SeasonService.getActiveSeason(division);
    const id = data.id ?? (await this.getNextTeamId(division));
    await prisma.team.create({
      data: {
        id,
        seasonId: season.id,
        name: data.name,
        logoUrl: data.logoUrl,
        logoPosition: data.logoPosition,
      },
    });
    const team: ITeam = {
      id,
      name: data.name,
      seasonId: season.id,
      players: data.players ?? [],
      logoUrl: data.logoUrl,
      logoPosition: data.logoPosition,
    };
    if (team.players.length > 0) {
      await this.saveTeam(team);
    }
    return team;
  }

  static async saveTeam(team: ITeam, options?: SaveTeamOptions): Promise<ITeam> {
    const seasonId = team.seasonId;
    if (!seasonId) {
      throw new Error('Team seasonId is required to save');
    }

    await prisma.$transaction(async (tx) => {
      for (const pl of team.players) {
        const existing = await tx.player.findUnique({
          where: { memberId: pl.memberId },
          select: { teamId: true, seasonId: true, active: true },
        });
        const shouldReactivate =
          !existing ||
          !existing.active ||
          existing.teamId !== team.id ||
          existing.seasonId !== seasonId;

        const profile = {
          firstName: pl.firstName,
          lastName: pl.lastName,
          nickname: pl.nickname,
          number: pl.number,
          position: pl.position,
          isCaptain: pl.isCaptain,
          headPhoto: pl.head_photo,
          pendingHeadPhoto: pl.pending_head_photo,
          bio: pl.bio,
          personalIdEnc: encryptPersonalIdIfNeeded(pl.personalId),
          birthYear: pl.birthYear,
        };

        await tx.player.upsert({
          where: { memberId: pl.memberId },
          create: {
            memberId: pl.memberId,
            teamId: team.id,
            seasonId,
            active: true,
            ...profile,
          },
          update: {
            teamId: team.id,
            seasonId,
            ...(shouldReactivate ? { active: true } : {}),
            ...profile,
          },
        });
      }

      await tx.team.update({
        where: { seasonId_id: { seasonId, id: team.id } },
        data: {
          name: team.name,
          description: team.description ?? '',
          logoUrl: team.logoUrl,
          logoPosition: team.logoPosition,
        },
      });
    });

    if (options?.invalidateCache !== false) {
      await invalidateTeamSeasonCaches(seasonId);
    }

    return team;
  }

  static async replaceSeasonRoster(
    teams: Array<{ id: number; name: string; players: IPlayer[]; logoUrl?: string }>,
    division: Division = Division.boys
  ): Promise<void> {
    const season = await SeasonService.getActiveSeason(division);
    await prisma.$transaction(async (tx) => {
      await tx.player.deleteMany({ where: { seasonId: season.id } });
      await tx.team.deleteMany({ where: { seasonId: season.id } });
      for (const t of teams) {
        await tx.team.create({
          data: {
            id: t.id,
            seasonId: season.id,
            name: t.name,
            logoUrl: t.logoUrl,
          },
        });
        for (const p of t.players) {
          await tx.player.create({
            data: {
              memberId: p.memberId,
              teamId: t.id,
              seasonId: season.id,
              firstName: p.firstName,
              lastName: p.lastName,
              nickname: p.nickname,
              number: p.number,
              position: p.position,
              isCaptain: p.isCaptain,
              headPhoto: p.head_photo,
              pendingHeadPhoto: p.pending_head_photo,
              bio: p.bio,
              personalIdEnc: encryptPersonalIdIfNeeded(p.personalId),
              birthYear: p.birthYear,
            },
          });
        }
      }
    });
    await invalidateDivisionCaches(division);
  }
}
