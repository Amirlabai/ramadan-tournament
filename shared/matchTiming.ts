import {
  getJerusalemParts,
  getWeekdayFromDateString,
  jerusalemDateKey,
} from './jerusalemDate';

export const MATCH_DURATION_MS = 60 * 60 * 1000;
const TOURNAMENT_POLL_WEEKDAYS = [5, 6] as const; // Fri, Sat
const TOURNAMENT_POLL_START_HOUR = 16;
const TOURNAMENT_POLL_END_HOUR = 21; // exclusive upper bound
/** Refresh status badges shortly before/after kickoff or full-time. */
const STATUS_CLOCK_MARGIN_MS = 2 * 60 * 1000;

export type MatchDisplayStatus = 'upcoming' | 'live' | 'finished';

type StatsMatchLike = {
  date: string | Date;
  score1: number | null;
  score2: number | null;
  technicalWinnerTeamId?: number | null;
};

function toMatchDateIso(date: string | Date): string {
  return date instanceof Date ? date.toISOString() : date;
}

function hasTechnicalWinner(
  technicalWinnerTeamId?: number | null
): boolean {
  return technicalWinnerTeamId != null;
}

/** Count in standings/scorers once the match has started (live or finished; scores required).
 * Technical wins count immediately when scores are set. */
export function shouldCountMatchInStats(
  match: StatsMatchLike,
  now: Date = new Date()
): match is StatsMatchLike & { score1: number; score2: number } {
  if (match.score1 == null || match.score2 == null) return false;
  if (hasTechnicalWinner(match.technicalWinnerTeamId)) return true;
  const status = getMatchDisplayStatus(toMatchDateIso(match.date), now, match.technicalWinnerTeamId);
  return status === 'live' || status === 'finished';
}

export function getMatchDisplayStatus(
  matchDateIso: string,
  now: Date = new Date(),
  technicalWinnerTeamId?: number | null
): MatchDisplayStatus {
  if (hasTechnicalWinner(technicalWinnerTeamId)) return 'finished';

  const kickoff = new Date(matchDateIso).getTime();
  if (!Number.isFinite(kickoff)) return 'upcoming';

  const current = now.getTime();
  const end = kickoff + MATCH_DURATION_MS;

  if (current < kickoff) return 'upcoming';
  if (current < end) return 'live';
  return 'finished';
}

export function isTournamentPollingWindow(now: Date = new Date()): boolean {
  const { hour } = getJerusalemParts(now);
  if (hour < TOURNAMENT_POLL_START_HOUR || hour >= TOURNAMENT_POLL_END_HOUR) {
    return false;
  }

  const weekday = getWeekdayFromDateString(jerusalemDateKey(now));
  return (TOURNAMENT_POLL_WEEKDAYS as readonly number[]).includes(weekday);
}

export function hasMatchOnJerusalemDate(
  matches: { date: string }[],
  now: Date = new Date()
): boolean {
  const todayKey = jerusalemDateKey(now);
  return matches.some((match) => jerusalemDateKey(new Date(match.date)) === todayKey);
}

export function shouldPollTournamentData(
  matches: { date: string }[],
  now: Date = new Date()
): boolean {
  return isTournamentPollingWindow(now) && hasMatchOnJerusalemDate(matches, now);
}

/** True when any match is near kickoff or full-time so UI should re-render status. */
export function needsMatchStatusClockTick(
  matches: { date: string; technicalWinnerTeamId?: number | null }[],
  now: Date = new Date()
): boolean {
  if (!matches.length) return false;

  const current = now.getTime();
  return matches.some((match) => {
    if (hasTechnicalWinner(match.technicalWinnerTeamId)) return false;
    const kickoff = new Date(match.date).getTime();
    if (!Number.isFinite(kickoff)) return false;
    const end = kickoff + MATCH_DURATION_MS;
    return (
      current >= kickoff - STATUS_CLOCK_MARGIN_MS &&
      current <= end + STATUS_CLOCK_MARGIN_MS
    );
  });
}
