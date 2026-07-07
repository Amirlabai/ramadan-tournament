import { shouldCountMatchInStats, effectiveTeamLogoUrl } from '@ramadan-tournament/shared';
import { prisma } from '../lib/prisma';
import { SeasonService } from './SeasonService';
import { StandingsEntry, TopScorer } from '../types/stats';

export interface PlayerStats {
  memberId: number;
  goals: number;
  gamesPlayed: number;
}

export class StatsService {
  static async calculateStandings(seasonId?: string): Promise<StandingsEntry[]> {
    const season = seasonId
      ? await prisma.season.findUniqueOrThrow({ where: { id: seasonId } })
      : await SeasonService.getActiveFootballSeason();

    const [teams, matches] = await Promise.all([
      prisma.team.findMany({ where: { seasonId: season.id } }),
      prisma.match.findMany({
        where: { seasonId: season.id, phase: 'group' },
        include: { goals: true },
      }),
    ]);

    const standings: { [key: number]: StandingsEntry } = {};
    teams.forEach((team) => {
      standings[team.id] = {
        teamId: team.id,
        teamName: team.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        logoUrl: effectiveTeamLogoUrl(team.id, team.logoUrl, season.id) || undefined,
      };
    });

    for (const match of matches) {
      if (!shouldCountMatchInStats(match)) continue;
      const team1 = standings[match.team1Id];
      const team2 = standings[match.team2Id];
      if (!team1 || !team2) continue;

      team1.played += 1;
      team2.played += 1;
      team1.goalsFor += match.score1;
      team1.goalsAgainst += match.score2;
      team2.goalsFor += match.score2;
      team2.goalsAgainst += match.score1;

      if (match.score1 > match.score2) {
        team1.won += 1;
        team1.points += 3;
        team2.lost += 1;
      } else if (match.score1 < match.score2) {
        team2.won += 1;
        team2.points += 3;
        team1.lost += 1;
      } else {
        team1.drawn += 1;
        team1.points += 1;
        team2.drawn += 1;
        team2.points += 1;
      }
    }

    const standingsList = Object.values(standings).map((entry) => ({
      ...entry,
      goalDifference: entry.goalsFor - entry.goalsAgainst,
    }));

    standingsList.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    return standingsList;
  }

  static async calculateTopScorers(seasonId?: string): Promise<TopScorer[]> {
    const season = seasonId
      ? await prisma.season.findUniqueOrThrow({ where: { id: seasonId } })
      : await SeasonService.getActiveFootballSeason();

    const [teams, matches] = await Promise.all([
      prisma.team.findMany({
        where: { seasonId: season.id },
        include: { players: { where: { active: true } } },
      }),
      prisma.match.findMany({
        where: { seasonId: season.id },
        include: { goals: true },
      }),
    ]);

    const members: { [key: number]: { name: string; teamName: string; position: string; teamId: number } } = {};
    const teamMatchesCount: { [key: number]: number } = {};

    teams.forEach((team) => {
      teamMatchesCount[team.id] = 0;
      team.players.forEach((player) => {
        members[player.memberId] = {
          name: `${player.firstName} ${player.lastName}`.trim() || player.nickname,
          teamName: team.name,
          position: player.position,
          teamId: team.id,
        };
      });
    });

    matches.forEach((match) => {
      if (shouldCountMatchInStats(match)) {
        if (teamMatchesCount[match.team1Id] !== undefined) teamMatchesCount[match.team1Id]++;
        if (teamMatchesCount[match.team2Id] !== undefined) teamMatchesCount[match.team2Id]++;
      }
    });

    const scorerStats: { [key: number]: TopScorer & { gamesPlayed: number } } = {};

    matches.forEach((match) => {
      if (!shouldCountMatchInStats(match)) return;
      match.goals.forEach((goal) => {
        const memberId = goal.memberId;
        const memberInfo = members[memberId];
        if (!scorerStats[memberId]) {
          scorerStats[memberId] = {
            memberId,
            playerName: memberInfo?.name || 'Unknown',
            teamName: memberInfo?.teamName || 'Unknown',
            teamId: memberInfo?.teamId || 0,
            position: memberInfo?.position || 'Unknown',
            goals: 0,
            gamesPlayed: memberInfo ? teamMatchesCount[memberInfo.teamId] : 0,
          };
        }
        scorerStats[memberId].goals += 1;
      });
    });

    return Object.values(scorerStats).sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      const avgA = a.gamesPlayed > 0 ? a.goals / a.gamesPlayed : 0;
      const avgB = b.gamesPlayed > 0 ? b.goals / b.gamesPlayed : 0;
      return avgB - avgA;
    });
  }

  static async calculatePlayerStats(seasonId?: string): Promise<PlayerStats[]> {
    const season = seasonId
      ? await prisma.season.findUniqueOrThrow({ where: { id: seasonId } })
      : await SeasonService.getActiveFootballSeason();

    const [teams, matches] = await Promise.all([
      prisma.team.findMany({
        where: { seasonId: season.id },
        include: { players: { where: { active: true } } },
      }),
      prisma.match.findMany({
        where: { seasonId: season.id },
        include: { goals: true },
      }),
    ]);

    const playerStats: { [key: number]: PlayerStats } = {};
    const teamPlayerMap: { [key: number]: number[] } = {};

    teams.forEach((team) => {
      teamPlayerMap[team.id] = team.players.map((p) => p.memberId);
      team.players.forEach((player) => {
        playerStats[player.memberId] = { memberId: player.memberId, goals: 0, gamesPlayed: 0 };
      });
    });

    matches.forEach((match) => {
      if (!shouldCountMatchInStats(match)) return;
      const team1Players = teamPlayerMap[match.team1Id] || [];
      const team2Players = teamPlayerMap[match.team2Id] || [];
      team1Players.forEach((id) => {
        if (playerStats[id]) playerStats[id].gamesPlayed += 1;
      });
      team2Players.forEach((id) => {
        if (playerStats[id]) playerStats[id].gamesPlayed += 1;
      });
      match.goals.forEach((goal) => {
        if (playerStats[goal.memberId]) playerStats[goal.memberId].goals += 1;
      });
    });

    return Object.values(playerStats);
  }
}
