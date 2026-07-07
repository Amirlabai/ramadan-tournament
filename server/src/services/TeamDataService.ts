import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { SeasonService } from './SeasonService';
import { StatsService } from './StatsService';
import { Division } from '@prisma/client';
import { effectiveTeamLogoUrl, teamCustomLogoUrl } from '@ramadan-tournament/shared';
import { PointsStatsService } from './PointsStatsService';

function formatPlayer(player: any, statsMap: Map<number, any>, ownerUserId: string | null) {
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
    isTeamOwner: !!ownerUserId && player.userId === ownerUserId,
    squadRole: player.squadRole ?? null,
    lineup: player.squadRole ? 'starting' : 'bench',
    head_photo: player.headPhoto || '',
    pending_head_photo: player.pendingHeadPhoto || '',
    bio: player.bio || '',
    hasPersonalId,
    totalGoals: playerStats?.goals || 0,
    gamesPlayed: playerStats?.gamesPlayed || 0,
  };
}

function formatTeam(
  team: any,
  statsMap: Map<number, any>,
  seasonId: string,
  division: Division,
  pointsTotal?: number
) {
  const customLogoUrl = teamCustomLogoUrl(team.logoUrl);
  const logoUrl =
    division === Division.boys
      ? effectiveTeamLogoUrl(team.id, team.logoUrl, seasonId)
      : customLogoUrl;
  return {
    id: team.id,
    name: team.name,
    description: team.description || '',
    logoUrl,
    customLogoUrl,
    logoPosition: team.logoPosition || 'right',
    ...(pointsTotal !== undefined ? { totalPoints: pointsTotal } : {}),
    players: team.players
      .filter((p: any) => p.active)
      .map((p: any) => formatPlayer(p, statsMap, team.ownerUserId ?? null)),
  };
}

export class TeamDataService {
  static async getTeamsDocument(division: Division = Division.boys) {
    const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
    if (!season) return [];
    const cacheKey = CacheService.key('doc', division, 'teams-v2', 'all', season.id);

    return CacheService.getOrSet(cacheKey, 120, async () => {
      const [teams, stats, pointsStandings] = await Promise.all([
        prisma.team.findMany({
          where: { seasonId: season.id },
          include: { players: { where: { active: true }, orderBy: { number: 'asc' } } },
          orderBy: { id: 'asc' },
        }),
        division === Division.boys ? StatsService.calculatePlayerStats(season.id) : Promise.resolve([]),
        division === Division.girls ? PointsStatsService.calculatePointsStandings(season.id) : Promise.resolve([]),
      ]);
      const statsMap = new Map(stats.map((s) => [s.memberId, s]));
      const pointsMap = new Map(pointsStandings.map((p) => [p.teamId, p.totalPoints]));
      return teams.map((t) =>
        formatTeam(
          t,
          statsMap,
          season.id,
          division,
          division === Division.girls ? pointsMap.get(t.id) ?? 0 : undefined
        )
      );
    });
  }

  static async getTeamById(teamId: number, division: Division = Division.boys) {
    const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
    if (!season) return null;
    const [team, stats] = await Promise.all([
      prisma.team.findFirst({
        where: { seasonId: season.id, id: teamId },
        include: { players: { where: { active: true }, orderBy: { number: 'asc' } } },
      }),
      division === Division.boys ? StatsService.calculatePlayerStats(season.id) : Promise.resolve([]),
    ]);
    if (!team) return null;
    const statsMap = new Map(stats.map((s) => [s.memberId, s]));
    return formatTeam(team, statsMap, season.id, division);
  }
}
