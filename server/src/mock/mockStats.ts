import { shouldCountMatchInStats, effectiveTeamLogoUrl } from '@ramadan-tournament/shared';
import type { StandingsEntry, TopScorer } from '../types/stats';
import type { PlayerStats } from '../services/StatsService';
import { getMockStore, MOCK_SEASON_ID, type MockMatch, type MockTeam } from './dataLoader';

export function calculateStandings(teams: MockTeam[], matches: MockMatch[]): StandingsEntry[] {
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
      logoUrl: effectiveTeamLogoUrl(team.id, team.logoUrl, MOCK_SEASON_ID) || undefined,
    };
  });

  for (const match of matches) {
    if (match.phase !== 'group' || !shouldCountMatchInStats(match)) continue;
    const team1 = standings[match.team1Id];
    const team2 = standings[match.team2Id];
    if (!team1 || !team2) continue;

    const techWinner = match.technicalWinnerTeamId;
    if (
      techWinner != null
      && techWinner !== match.team1Id
      && techWinner !== match.team2Id
    ) {
      continue;
    }

    team1.played += 1;
    team2.played += 1;
    team1.goalsFor += match.score1;
    team1.goalsAgainst += match.score2;
    team2.goalsFor += match.score2;
    team2.goalsAgainst += match.score1;

    if (techWinner === match.team1Id) {
      team1.won += 1;
      team1.points += 3;
      team2.lost += 1;
    } else if (techWinner === match.team2Id) {
      team2.won += 1;
      team2.points += 3;
      team1.lost += 1;
    } else if (match.score1 > match.score2) {
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

  return Object.values(standings)
    .map((entry) => ({
      ...entry,
      goalDifference: entry.goalsFor - entry.goalsAgainst,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
}

export function calculateTopScorers(teams: MockTeam[], matches: MockMatch[]): TopScorer[] {
  const members: Record<
    number,
    {
      name: string;
      teamName: string;
      position: string;
      teamId: number;
      head_photo?: string;
      isCaptain?: boolean;
      isTeamOwner?: boolean;
      squadRole?: string | null;
    }
  > = {};
  const teamMatchesCount: Record<number, number> = {};

  teams.forEach((team) => {
    teamMatchesCount[team.id] = 0;
    team.players.forEach((player) => {
      members[player.memberId] = {
        name: `${player.firstName} ${player.lastName}`.trim() || player.nickname,
        teamName: team.name,
        position: player.position,
        teamId: team.id,
        head_photo: player.head_photo || undefined,
        isCaptain: player.isCaptain,
        isTeamOwner: undefined,
        squadRole: null,
      };
    });
  });

  matches.forEach((match) => {
    if (shouldCountMatchInStats(match)) {
      if (teamMatchesCount[match.team1Id] !== undefined) teamMatchesCount[match.team1Id]++;
      if (teamMatchesCount[match.team2Id] !== undefined) teamMatchesCount[match.team2Id]++;
    }
  });

  const scorerStats: Record<number, TopScorer & { gamesPlayed: number }> = {};

  matches.forEach((match) => {
    if (!shouldCountMatchInStats(match)) return;
    match.goals.forEach((goal) => {
      if (goal.isOwnGoal || goal.memberId == null) return;
      const memberId = goal.memberId;
      const memberInfo = members[memberId];
      if (!scorerStats[memberId]) {
        scorerStats[memberId] = {
          memberId,
          playerName: memberInfo?.name || 'Unknown',
          teamName: memberInfo?.teamName || 'Unknown',
          teamId: memberInfo?.teamId || 0,
          position: memberInfo?.position || 'Unknown',
          head_photo: memberInfo?.head_photo,
          isCaptain: memberInfo?.isCaptain,
          isTeamOwner: memberInfo?.isTeamOwner,
          squadRole: memberInfo?.squadRole,
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

export function calculatePlayerStats(teams: MockTeam[], matches: MockMatch[]): PlayerStats[] {
  const playerStats: Record<number, PlayerStats> = {};
  const teamPlayerMap: Record<number, number[]> = {};

  teams.forEach((team) => {
    teamPlayerMap[team.id] = team.players.map((p) => p.memberId);
    team.players.forEach((player) => {
      playerStats[player.memberId] = { memberId: player.memberId, goals: 0, gamesPlayed: 0 };
    });
  });

  matches.forEach((match) => {
    if (!shouldCountMatchInStats(match)) return;
    (teamPlayerMap[match.team1Id] || []).forEach((id) => {
      if (playerStats[id]) playerStats[id].gamesPlayed += 1;
    });
    (teamPlayerMap[match.team2Id] || []).forEach((id) => {
      if (playerStats[id]) playerStats[id].gamesPlayed += 1;
    });
    match.goals.forEach((goal) => {
      if (goal.isOwnGoal || goal.memberId == null) return;
      if (playerStats[goal.memberId]) playerStats[goal.memberId].goals += 1;
    });
  });

  return Object.values(playerStats);
}

export function getStatsMaps() {
  const { teams, matches } = getMockStore();
  const playerStats = calculatePlayerStats(teams, matches);
  const statsMap = new Map(playerStats.map((s) => [s.memberId, s]));
  return { teams, matches, playerStats, statsMap };
}

export function getStandings() {
  const { teams, matches } = getMockStore();
  return calculateStandings(teams, matches);
}

export function getTopScorers() {
  const { teams, matches } = getMockStore();
  return calculateTopScorers(teams, matches);
}

export function getPlayerStats() {
  const { teams, matches } = getMockStore();
  return calculatePlayerStats(teams, matches);
}
