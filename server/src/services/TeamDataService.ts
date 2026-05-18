import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { SeasonService } from './SeasonService';
import { StatsService } from './StatsService';
import { Division } from '@prisma/client';

function formatPlayer(player: any, statsMap: Map<number, any>) {
  const playerStats = statsMap.get(player.memberId);
  const hasPersonalId = !!player.personalIdEnc;
  return {
    memberId: player.memberId,
    firstName: player.firstName,
    lastName: player.lastName,
    nickname: player.nickname,
    number: player.number,
    position: player.position,
    isCaptain: player.isCaptain,
    head_photo: player.headPhoto || '',
    pending_head_photo: player.pendingHeadPhoto || '',
    bio: player.bio || '',
    hasPersonalId,
    totalGoals: playerStats?.goals || 0,
    gamesPlayed: playerStats?.gamesPlayed || 0,
  };
}

function formatTeam(team: any, statsMap: Map<number, any>) {
  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl || '',
    logoPosition: team.logoPosition || 'right',
    players: team.players
      .filter((p: any) => p.active)
      .map((p: any) => formatPlayer(p, statsMap)),
  };
}

export class TeamDataService {
  static async getTeamsDocument(division: Division = Division.boys) {
    const season = await SeasonService.getActiveSeason(division);
    const cacheKey = CacheService.key('doc', division, 'teams', 'all', season.id);

    return CacheService.getOrSet(cacheKey, 120, async () => {
      const [teams, stats] = await Promise.all([
        prisma.team.findMany({
          where: { seasonId: season.id },
          include: { players: { where: { active: true }, orderBy: { number: 'asc' } } },
          orderBy: { id: 'asc' },
        }),
        division === Division.boys ? StatsService.calculatePlayerStats(season.id) : Promise.resolve([]),
      ]);
      const statsMap = new Map(stats.map((s) => [s.memberId, s]));
      return teams.map((t) => formatTeam(t, statsMap));
    });
  }

  static async getTeamById(teamId: number, division: Division = Division.boys) {
    const season = await SeasonService.getActiveSeason(division);
    const [team, stats] = await Promise.all([
      prisma.team.findFirst({
        where: { seasonId: season.id, id: teamId },
        include: { players: { where: { active: true }, orderBy: { number: 'asc' } } },
      }),
      division === Division.boys ? StatsService.calculatePlayerStats(season.id) : Promise.resolve([]),
    ]);
    if (!team) return null;
    const statsMap = new Map(stats.map((s) => [s.memberId, s]));
    return formatTeam(team, statsMap);
  }
}
