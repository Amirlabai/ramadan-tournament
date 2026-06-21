import { Division } from '@prisma/client';
import { prisma } from '../lib/prisma';

import { SeasonService } from '../services/SeasonService';
import { encryptPersonalIdIfNeeded, personalIdLookupValues } from '../utils/personalIdCrypto';



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

  toObject(): IPlayer;

}



export interface ITeam {

  id: number;

  name: string;

  players: IPlayer[];

  logoUrl?: string;

  logoPosition?: string;

  seasonId?: string;

  markModified(_field: string): void;

  save(): Promise<ITeam>;

  toObject(): ITeam;

}



function mapPlayer(p: any): IPlayer {

  const player: IPlayer = {

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

    personalId: undefined,

    birthYear: p.birthYear ?? undefined,

    toObject() {

      return { ...player };

    },

  };

  return player;

}



function mapTeam(row: any, players: any[]): ITeam {

  const team: ITeam = {

    id: row.id,

    name: row.name,

    logoUrl: row.logoUrl || '',

    logoPosition: row.logoPosition || 'right',

    seasonId: row.seasonId,

    players: players.map(mapPlayer),

    markModified() {},

    async save() {

      for (const pl of team.players) {

        await prisma.player.upsert({

          where: { memberId: pl.memberId },

          create: {

            memberId: pl.memberId,

            teamId: team.id,

            seasonId: team.seasonId!,

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

          },

          update: {

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

          },

        });

      }

      await prisma.team.update({

        where: { seasonId_id: { seasonId: team.seasonId!, id: team.id } },

        data: {

          name: team.name,

          logoUrl: team.logoUrl,

          logoPosition: team.logoPosition,

        },

      });

      return team;

    },

    toObject() {

      return {

        ...team,

        players: team.players.map((p) => p.toObject()),

      };

    },

  };

  return team;

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



type TeamFilter = Record<string, unknown>;



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



function teamChain<T>(
  load: () => Promise<T>,
  division: Division = Division.boys
): {

  sort(sort: { id?: 1 | -1 }): ReturnType<typeof teamChain<T>>;

  select(_fields: string): Promise<T>;

  lean(): Promise<T>;

  then(resolve: (v: T) => void, reject?: (e: unknown) => void): void;

} {

  let sortOpt: { id?: 1 | -1 } | undefined;

  const exec = async (): Promise<T> => {

    if (sortOpt) {

      return loadTeams({}, sortOpt, division) as unknown as T;

    }

    return load();

  };

  const c = {

    sort(sort: { id?: 1 | -1 }) {

      sortOpt = sort;

      return c;

    },

    select: async () => exec(),

    lean: async () => exec(),

    then(resolve: (v: T) => void, reject?: (e: unknown) => void) {

      exec().then(resolve, reject);

    },

  };

  return c;

}



export class Team {

  id?: number;

  name?: string;

  players: IPlayer[] = [];

  logoUrl?: string;

  logoPosition?: string;

  seasonId?: string;



  constructor(data: Partial<ITeam>) {

    Object.assign(this, data);

  }



  markModified(_field: string) {}



  async save(): Promise<ITeam> {

    const season = await SeasonService.getActiveFootballSeason();

    this.seasonId = season.id;

    if (!this.id) {

      const max = await prisma.team.findFirst({

        where: { seasonId: season.id },

        orderBy: { id: 'desc' },

      });

      this.id = (max?.id ?? 0) + 1;

      await prisma.team.create({

        data: {

          id: this.id,

          seasonId: season.id,

          name: this.name!,

          logoUrl: this.logoUrl,

          logoPosition: this.logoPosition,

        },

      });

    }

    return mapTeam({ ...this, seasonId: season.id }, this.players).save();

  }



  static find(filter: TeamFilter = {}, division: Division = Division.boys) {

    return teamChain(() => findTeams(filter, division), division);

  }



  static findOne(filter: TeamFilter = {}, division: Division = Division.boys) {

    return teamChain(async () => {

      const teams = await findTeams(filter, division);

      return teams[0] ?? null;

    }, division);

  }



  static async insertMany(_docs: unknown[]) {

    throw new Error('Use prisma db seed instead of insertMany');

  }



  static async deleteMany(_filter: Record<string, unknown> = {}) {

    const season = await SeasonService.getActiveFootballSeason();

    await prisma.player.deleteMany({ where: { seasonId: season.id } });

    await prisma.team.deleteMany({ where: { seasonId: season.id } });

  }

}


