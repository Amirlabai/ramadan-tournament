import { getMatchDisplayStatus, shouldCountMatchInStats } from '@ramadan-tournament/shared';
import { jerusalemDateTime } from '../utils/jerusalemDate';
import { Match, type IMatch } from '../models/Match';
import { StatsService } from './StatsService';

export const SEMI_DATE = '2026-08-01';
export const FINAL_DATE = '2026-08-08';
export const VENUE_NORTH = 'מגרש כדורגל צפוני';
export const VENUE_SOUTH = 'מגרש כדורגל דרומי';

export const LOWER_SEMI_IDS = { fifthVsEighth: 1001, sixthVsSeventh: 1002 } as const;
export const UPPER_SEMI_IDS = { secondVsThird: 1003, firstVsFourth: 1004 } as const;
export const LOWER_FINAL_ID = 2001;
export const UPPER_FINAL_ID = 2002;

type MatchResultFields = Pick<
  IMatch,
  'team1Id' | 'team2Id' | 'score1' | 'score2' | 'technicalWinnerTeamId' | 'date'
>;

function toKickoffIso(date: Date | string): string {
  return date instanceof Date ? date.toISOString() : date;
}

/**
 * True when sync must not rewrite teams: kickoff has passed (live/finished),
 * or the match already counts as a result (incl. technical win).
 */
export function matchHasResult(
  m: MatchResultFields,
  now: Date = new Date()
): boolean {
  if (shouldCountMatchInStats(m, now)) return true;
  return getMatchDisplayStatus(toKickoffIso(m.date), now, m.technicalWinnerTeamId) !== 'upcoming';
}

/**
 * Winner from decisive score or technical win. Kickoff is not required so early
 * admin score entry can seed the final; draws / incomplete scores return null.
 */
export function winnerTeamId(
  m: MatchResultFields | null | undefined
): number | null {
  if (!m) return null;
  if (m.technicalWinnerTeamId != null) return m.technicalWinnerTeamId;
  if (m.score1 == null || m.score2 == null) return null;
  if (m.score1 === m.score2) return null;
  return m.score1 > m.score2 ? m.team1Id : m.team2Id;
}

function clearResultFields(): Pick<
  IMatch,
  'goals' | 'score1' | 'score2' | 'technicalWinnerTeamId'
> {
  return {
    goals: [],
    score1: null,
    score2: null,
    technicalWinnerTeamId: null,
  };
}

async function refreshSchedule(id: number, date: Date, location: string): Promise<void> {
  await Match.findOneAndUpdate(
    { id },
    {
      date,
      location,
      phase: 'knockout',
    },
    { new: true }
  );
}

export class PlayoffService {
  static async syncPlayoffs(): Promise<void> {
    const standings = await StatsService.calculateStandings();

    if (standings.length < 8) {
      throw new Error(`Not enough teams for playoffs. Found ${standings.length}, need at least 8.`);
    }

    const top8 = standings.slice(0, 8);
    const teamsByRank: { [rank: number]: number } = {};
    top8.forEach((entry, index) => {
      teamsByRank[index + 1] = entry.teamId;
    });

    // Sat 01/08 — semis: lower @ 17:00, upper @ 18:00; north/south split is arbitrary
    const semiSlots = [
      {
        rank1: 5,
        rank2: 8,
        time: '17:00',
        location: VENUE_NORTH,
        customId: LOWER_SEMI_IDS.fifthVsEighth,
      },
      {
        rank1: 6,
        rank2: 7,
        time: '17:00',
        location: VENUE_SOUTH,
        customId: LOWER_SEMI_IDS.sixthVsSeventh,
      },
      {
        rank1: 2,
        rank2: 3,
        time: '18:00',
        location: VENUE_NORTH,
        customId: UPPER_SEMI_IDS.secondVsThird,
      },
      {
        rank1: 1,
        rank2: 4,
        time: '18:00',
        location: VENUE_SOUTH,
        customId: UPPER_SEMI_IDS.firstVsFourth,
      },
    ];

    const semiById = new Map<number, IMatch>();

    for (const slot of semiSlots) {
      const matchDate = jerusalemDateTime(SEMI_DATE, slot.time);
      const team1Id = teamsByRank[slot.rank1];
      const team2Id = teamsByRank[slot.rank2];
      const existing = await Match.findOne({ id: slot.customId });

      if (existing && matchHasResult(existing)) {
        await refreshSchedule(slot.customId, matchDate, slot.location);
        semiById.set(slot.customId, {
          ...existing,
          date: matchDate,
          location: slot.location,
          phase: 'knockout',
        });
        continue;
      }

      const teamsChanged =
        !existing || existing.team1Id !== team1Id || existing.team2Id !== team2Id;

      const updateBody: Partial<IMatch> = {
        id: slot.customId,
        date: matchDate,
        location: slot.location,
        phase: 'knockout',
        team1Id,
        team2Id,
      };
      if (teamsChanged) {
        Object.assign(updateBody, clearResultFields());
      }

      const updated = await Match.findOneAndUpdate({ id: slot.customId }, updateBody, {
        upsert: true,
        new: true,
      });
      if (updated) semiById.set(slot.customId, updated);
    }

    // Sat 08/08 — finals sequential on north; teams only when both semis have winners
    await PlayoffService.syncFinalSlot({
      id: LOWER_FINAL_ID,
      time: '17:30',
      location: VENUE_NORTH,
      semiA: semiById.get(LOWER_SEMI_IDS.fifthVsEighth) ?? null,
      semiB: semiById.get(LOWER_SEMI_IDS.sixthVsSeventh) ?? null,
    });
    await PlayoffService.syncFinalSlot({
      id: UPPER_FINAL_ID,
      time: '18:30',
      location: VENUE_NORTH,
      semiA: semiById.get(UPPER_SEMI_IDS.secondVsThird) ?? null,
      semiB: semiById.get(UPPER_SEMI_IDS.firstVsFourth) ?? null,
    });
  }

  private static async syncFinalSlot(opts: {
    id: number;
    time: string;
    location: string;
    semiA: IMatch | null | undefined;
    semiB: IMatch | null | undefined;
  }): Promise<void> {
    const matchDate = jerusalemDateTime(FINAL_DATE, opts.time);
    const existing = await Match.findOne({ id: opts.id });
    const team1Id = winnerTeamId(opts.semiA);
    const team2Id = winnerTeamId(opts.semiB);
    const winnersReady = team1Id != null && team2Id != null;

    if (!winnersReady) {
      // Drop provisional / stale finalists (legacy teamId 0 placeholders or old syncs)
      if (existing) {
        await Match.findOneAndDelete({ id: opts.id });
      }
      return;
    }

    if (existing && matchHasResult(existing)) {
      if (existing.team1Id !== team1Id || existing.team2Id !== team2Id) {
        console.warn(
          `[PlayoffService] Final ${opts.id} already has a result; keeping teams ${existing.team1Id}/${existing.team2Id} despite semi winners ${team1Id}/${team2Id}`
        );
      }
      await refreshSchedule(opts.id, matchDate, opts.location);
      return;
    }

    const teamsChanged =
      !existing || existing.team1Id !== team1Id || existing.team2Id !== team2Id;

    const updateBody: Partial<IMatch> = {
      id: opts.id,
      date: matchDate,
      location: opts.location,
      phase: 'knockout',
      team1Id,
      team2Id,
    };
    if (teamsChanged) {
      Object.assign(updateBody, clearResultFields());
    }

    await Match.findOneAndUpdate({ id: opts.id }, updateBody, {
      upsert: true,
      new: true,
    });
  }
}
