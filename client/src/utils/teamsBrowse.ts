import type { Player, Team } from '../types';
import { fullName } from './playerDisplayName';

/** Player-name search: filters teams that have a matching roster player. */
export function playerMatchesQuery(player: Player, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    player.nickname,
    player.firstName,
    player.lastName,
    fullName(player),
    String(player.number || ''),
    player.position || '',
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function teamHasPlayerMatch(team: Team, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  return (team.players ?? []).some((p) => playerMatchesQuery(p, q));
}

export function filterRosterPlayers(players: Player[], query: string): Player[] {
  const q = query.trim();
  if (!q) return players;
  return players.filter((p) => playerMatchesQuery(p, q));
}

export function sortTeamsById<T extends { id: number }>(teams: T[]): T[] {
  return [...teams].sort((a, b) => a.id - b.id);
}

/** Top scorer on a roster (goals, then goals/game). Null if nobody has scored. */
export function getTeamTopScorer(players: Player[]): Player | null {
  if (!players.length) return null;
  const top = [...players].sort((a, b) => {
    const goalsA = a.totalGoals || 0;
    const goalsB = b.totalGoals || 0;
    if (goalsB !== goalsA) return goalsB - goalsA;
    const avgA = a.totalGoals && a.gamesPlayed ? a.totalGoals / a.gamesPlayed : 0;
    const avgB = b.totalGoals && b.gamesPlayed ? b.totalGoals / b.gamesPlayed : 0;
    return avgB - avgA;
  })[0];
  return (top.totalGoals || 0) > 0 ? top : null;
}

export function computeTeamsBrowseSummary(teams: Team[]) {
  let playerCount = 0;
  let goalCount = 0;
  for (const team of teams) {
    for (const p of team.players ?? []) {
      playerCount += 1;
      goalCount += p.totalGoals || 0;
    }
  }
  return {
    teamCount: teams.length,
    playerCount,
    goalCount,
  };
}
