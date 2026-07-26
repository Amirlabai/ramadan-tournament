import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jerusalemDateTime } from '../utils/jerusalemDate';

const {
  mockFindOne,
  mockFindOneAndUpdate,
  mockFindOneAndDelete,
  mockCalculateStandings,
} = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockFindOneAndDelete: vi.fn(),
  mockCalculateStandings: vi.fn(),
}));

vi.mock('../models/Match', () => ({
  Match: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
    findOneAndDelete: (...args: unknown[]) => mockFindOneAndDelete(...args),
  },
}));

vi.mock('./StatsService', () => ({
  StatsService: {
    calculateStandings: (...args: unknown[]) => mockCalculateStandings(...args),
  },
}));

import {
  FINAL_DATE,
  LOWER_FINAL_ID,
  LOWER_SEMI_IDS,
  PlayoffService,
  SEMI_DATE,
  UPPER_FINAL_ID,
  UPPER_SEMI_IDS,
  VENUE_NORTH,
  matchHasResult,
  winnerTeamId,
} from './PlayoffService';

const pastKickoff = jerusalemDateTime('2026-07-10', '17:00');
const pastNow = jerusalemDateTime('2026-07-10', '18:30');
const liveNow = jerusalemDateTime('2026-07-10', '17:30');
const futureKickoff = jerusalemDateTime('2026-08-01', '17:00');
const beforeKickoffNow = jerusalemDateTime('2026-08-01', '16:00');

function standingsEight() {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((teamId) => ({
    teamId,
    teamName: `T${teamId}`,
    played: 7,
    won: 8 - teamId,
    drawn: 0,
    lost: teamId - 1,
    goalsFor: 10,
    goalsAgainst: 0,
    goalDifference: 10,
    points: (8 - teamId) * 3,
  }));
}

function installStore(store: Map<number, Record<string, unknown>>) {
  mockFindOne.mockImplementation(async (filter: { id: number }) => {
    const row = store.get(filter.id);
    return row ? { ...row } : null;
  });
  mockFindOneAndUpdate.mockImplementation(async (filter: { id: number }, body: Record<string, unknown>) => {
    const prev = store.get(filter.id) ?? {};
    const next = { ...prev, ...body, id: filter.id, phase: 'knockout' };
    store.set(filter.id, next);
    return { ...next };
  });
  mockFindOneAndDelete.mockImplementation(async (filter: { id: number }) => {
    const prev = store.get(filter.id) ?? null;
    store.delete(filter.id);
    return prev;
  });
}

describe('PlayoffService helpers', () => {
  describe('matchHasResult', () => {
    it('is false for empty upcoming shell', () => {
      expect(
        matchHasResult(
          {
            team1Id: 1,
            team2Id: 2,
            score1: null,
            score2: null,
            technicalWinnerTeamId: null,
            date: futureKickoff,
          },
          beforeKickoffNow
        )
      ).toBe(false);
    });

    it('is false for stored 0-0 before kickoff', () => {
      expect(
        matchHasResult(
          {
            team1Id: 1,
            team2Id: 2,
            score1: 0,
            score2: 0,
            technicalWinnerTeamId: null,
            date: futureKickoff,
          },
          beforeKickoffNow
        )
      ).toBe(false);
    });

    it('is true once kickoff has passed even with null scores', () => {
      expect(
        matchHasResult(
          {
            team1Id: 1,
            team2Id: 2,
            score1: null,
            score2: null,
            technicalWinnerTeamId: null,
            date: pastKickoff,
          },
          liveNow
        )
      ).toBe(true);
    });

    it('is true for 0-0 after full-time', () => {
      expect(
        matchHasResult(
          {
            team1Id: 1,
            team2Id: 2,
            score1: 0,
            score2: 0,
            technicalWinnerTeamId: null,
            date: pastKickoff,
          },
          pastNow
        )
      ).toBe(true);
    });

    it('is true for technical win', () => {
      expect(
        matchHasResult(
          {
            team1Id: 1,
            team2Id: 2,
            score1: 0,
            score2: 0,
            technicalWinnerTeamId: 1,
            date: futureKickoff,
          },
          beforeKickoffNow
        )
      ).toBe(true);
    });
  });

  describe('winnerTeamId', () => {
    it('returns null when match missing', () => {
      expect(winnerTeamId(null)).toBeNull();
      expect(winnerTeamId(undefined)).toBeNull();
    });

    it('prefers technicalWinnerTeamId', () => {
      expect(
        winnerTeamId({
          team1Id: 10,
          team2Id: 20,
          score1: 3,
          score2: 1,
          technicalWinnerTeamId: 20,
          date: pastKickoff,
        })
      ).toBe(20);
    });

    it('picks higher score even before kickoff', () => {
      expect(
        winnerTeamId({
          team1Id: 10,
          team2Id: 20,
          score1: 2,
          score2: 1,
          technicalWinnerTeamId: null,
          date: futureKickoff,
        })
      ).toBe(10);
      expect(
        winnerTeamId({
          team1Id: 10,
          team2Id: 20,
          score1: 0,
          score2: 1,
          technicalWinnerTeamId: null,
          date: pastKickoff,
        })
      ).toBe(20);
    });

    it('returns null on draw or incomplete score', () => {
      expect(
        winnerTeamId({
          team1Id: 10,
          team2Id: 20,
          score1: 1,
          score2: 1,
          technicalWinnerTeamId: null,
          date: pastKickoff,
        })
      ).toBeNull();
      expect(
        winnerTeamId({
          team1Id: 10,
          team2Id: 20,
          score1: 1,
          score2: null,
          technicalWinnerTeamId: null,
          date: pastKickoff,
        })
      ).toBeNull();
    });
  });

  describe('schedule constants', () => {
    it('keeps distinct knockout match ids', () => {
      const ids = [
        LOWER_SEMI_IDS.fifthVsEighth,
        LOWER_SEMI_IDS.sixthVsSeventh,
        UPPER_SEMI_IDS.secondVsThird,
        UPPER_SEMI_IDS.firstVsFourth,
        LOWER_FINAL_ID,
        UPPER_FINAL_ID,
      ];
      expect(new Set(ids).size).toBe(ids.length);
      expect(SEMI_DATE).toBe('2026-08-01');
      expect(FINAL_DATE).toBe('2026-08-08');
    });
  });
});

describe('PlayoffService.syncPlayoffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculateStandings.mockResolvedValue(standingsEight());
  });

  it('second sync keeps teams and does not clear unchanged open semis', async () => {
    const store = new Map<number, Record<string, unknown>>();
    installStore(store);

    await PlayoffService.syncPlayoffs();
    await PlayoffService.syncPlayoffs();

    const semi = store.get(LOWER_SEMI_IDS.fifthVsEighth)!;
    expect(semi.team1Id).toBe(5);
    expect(semi.team2Id).toBe(8);
    expect(semi.score1).toBeNull();
    expect(semi.score2).toBeNull();

    const clearWrites = mockFindOneAndUpdate.mock.calls.filter(
      ([filter, body]: [{ id: number }, Record<string, unknown>]) =>
        filter.id === LOWER_SEMI_IDS.fifthVsEighth &&
        Object.prototype.hasOwnProperty.call(body, 'score1')
    );
    // First seed clears; second sync with same teams must not re-clear
    expect(clearWrites).toHaveLength(1);
  });

  it('second sync keeps admin goals/scores when teams are unchanged', async () => {
    const store = new Map<number, Record<string, unknown>>();
    installStore(store);

    await PlayoffService.syncPlayoffs();

    const semiId = LOWER_SEMI_IDS.fifthVsEighth;
    store.set(semiId, {
      ...store.get(semiId)!,
      score1: 2,
      score2: 1,
      goals: [{ minute: 12, memberId: 9 }],
      technicalWinnerTeamId: null,
    });

    await PlayoffService.syncPlayoffs();

    const semi = store.get(semiId)!;
    expect(semi.team1Id).toBe(5);
    expect(semi.team2Id).toBe(8);
    expect(semi.score1).toBe(2);
    expect(semi.score2).toBe(1);
    expect(semi.goals).toEqual([{ minute: 12, memberId: 9 }]);

    const clearWrites = mockFindOneAndUpdate.mock.calls.filter(
      ([filter, body]: [{ id: number }, Record<string, unknown>]) =>
        filter.id === semiId && body.score1 === null
    );
    expect(clearWrites).toHaveLength(1); // only the initial seed
  });

  it('does not invent finals before semis have winners and deletes provisional rows', async () => {
    const store = new Map<number, Record<string, unknown>>([
      [
        LOWER_FINAL_ID,
        {
          id: LOWER_FINAL_ID,
          team1Id: 0,
          team2Id: 0,
          score1: null,
          score2: null,
          date: jerusalemDateTime(FINAL_DATE, '17:30'),
          location: VENUE_NORTH,
          phase: 'knockout',
          goals: [],
          technicalWinnerTeamId: null,
        },
      ],
    ]);
    installStore(store);

    await PlayoffService.syncPlayoffs();

    expect(store.has(LOWER_FINAL_ID)).toBe(false);
    expect(mockFindOneAndDelete).toHaveBeenCalledWith({ id: LOWER_FINAL_ID });
    const finalUpserts = mockFindOneAndUpdate.mock.calls.filter(
      ([filter]: [{ id: number }]) => filter.id === LOWER_FINAL_ID || filter.id === UPPER_FINAL_ID
    );
    expect(finalUpserts).toHaveLength(0);
  });

  it('fills finals from finished semis and does not reseed a finished semi', async () => {
    const store = new Map<number, Record<string, unknown>>();
    installStore(store);

    const finishedSemi = (id: number, team1Id: number, team2Id: number, score1: number, score2: number) => {
      store.set(id, {
        id,
        team1Id,
        team2Id,
        score1,
        score2,
        date: pastKickoff,
        location: 'x',
        phase: 'knockout',
        goals: [],
        technicalWinnerTeamId: null,
      });
    };

    finishedSemi(LOWER_SEMI_IDS.fifthVsEighth, 5, 8, 3, 1);
    finishedSemi(LOWER_SEMI_IDS.sixthVsSeventh, 6, 7, 0, 2);
    finishedSemi(UPPER_SEMI_IDS.secondVsThird, 2, 3, 1, 0);
    finishedSemi(UPPER_SEMI_IDS.firstVsFourth, 1, 4, 2, 0);

    await PlayoffService.syncPlayoffs();

    const lowerFinal = store.get(LOWER_FINAL_ID)!;
    expect(lowerFinal.team1Id).toBe(5);
    expect(lowerFinal.team2Id).toBe(7);
    expect(lowerFinal.score1).toBeNull();
    expect(lowerFinal.score2).toBeNull();

    const upperFinal = store.get(UPPER_FINAL_ID)!;
    expect(upperFinal.team1Id).toBe(2);
    expect(upperFinal.team2Id).toBe(1);

    const semiReseeds = mockFindOneAndUpdate.mock.calls.filter(
      ([filter, body]: [{ id: number }, Record<string, unknown>]) =>
        filter.id === LOWER_SEMI_IDS.fifthVsEighth && body.team1Id != null
    );
    expect(semiReseeds).toHaveLength(0);

    const scheduleOnly = mockFindOneAndUpdate.mock.calls.filter(
      ([filter, body]: [{ id: number }, Record<string, unknown>]) =>
        filter.id === LOWER_SEMI_IDS.fifthVsEighth && body.date != null && body.team1Id == null
    );
    expect(scheduleOnly.length).toBeGreaterThanOrEqual(1);
  });
});
