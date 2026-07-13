import { shouldCountMatchInStats, type FormResult, type TeamBias } from '@ramadan-tournament/shared';

export type FormBiasMatch = {
  id: number;
  date: Date | string;
  team1Id: number;
  team2Id: number;
  score1: number | null;
  score2: number | null;
  technicalWinnerTeamId?: number | null;
};

function toTime(date: Date | string): number {
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function resultForTeam(match: FormBiasMatch, teamId: number): FormResult | null {
  if (match.score1 == null || match.score2 == null) return null;
  const tech = match.technicalWinnerTeamId;
  if (tech != null) {
    if (tech === teamId) return 'W';
    if (tech === match.team1Id || tech === match.team2Id) return 'L';
    return null;
  }
  const mine = teamId === match.team1Id ? match.score1 : match.score2;
  const theirs = teamId === match.team1Id ? match.score2 : match.score1;
  if (mine > theirs) return 'W';
  if (mine < theirs) return 'L';
  return 'D';
}

/** Season form/GD from matches strictly before `beforeDate` for `teamId`. */
export function accumulateTeamFormBias(
  matches: FormBiasMatch[],
  teamId: number,
  beforeDate: Date | string
): { bias: TeamBias; form: FormResult[] } {
  let played = 0;
  let points = 0;
  let gd = 0;
  const formChronological: FormResult[] = [];
  const cutoff = toTime(beforeDate);

  const ordered = [...matches].sort((a, b) => toTime(a.date) - toTime(b.date));
  for (const match of ordered) {
    if (toTime(match.date) >= cutoff) continue;
    if (!shouldCountMatchInStats(match)) continue;
    if (match.team1Id !== teamId && match.team2Id !== teamId) continue;
    const result = resultForTeam(match, teamId);
    if (!result) continue;

    const gf = teamId === match.team1Id ? (match.score1 as number) : (match.score2 as number);
    const ga = teamId === match.team1Id ? (match.score2 as number) : (match.score1 as number);
    played += 1;
    gd += gf - ga;
    if (result === 'W') points += 3;
    else if (result === 'D') points += 1;
    formChronological.push(result);
  }

  return {
    bias: { gd, points, played },
    form: formChronological.slice(-3),
  };
}
