import type { Match } from '../types';

/** Hide knockout placeholders until both teams are known (football-data.org sends null/TBD slots). */
export function isDisplayableKnockoutMatch(
  m: Pick<Match, 'phase' | 'team1Id' | 'team2Id' | 'team1Name' | 'team2Name'>
): boolean {
  if (m.phase !== 'knockout') return false;
  if (m.team1Id == null || m.team2Id == null) return false;
  if (!m.team1Name?.trim() || !m.team2Name?.trim()) return false;
  return true;
}

export function filterDisplayableKnockoutMatches(matches: Match[]): Match[] {
  return matches.filter(isDisplayableKnockoutMatch);
}
