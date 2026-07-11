import { describe, expect, it } from 'vitest';
import { jerusalemDateTime } from './jerusalemDate';
import {
  getMatchDisplayStatus,
  hasMatchOnJerusalemDate,
  isTournamentPollingWindow,
  needsMatchStatusClockTick,
  shouldCountMatchInStats,
  shouldPollTournamentData,
} from './matchTiming';

describe('getMatchDisplayStatus', () => {
  const kickoffIso = jerusalemDateTime('2026-07-10', '17:00').toISOString();

  it('returns upcoming before kickoff', () => {
    const now = jerusalemDateTime('2026-07-10', '16:30');
    expect(getMatchDisplayStatus(kickoffIso, now)).toBe('upcoming');
  });

  it('returns live during the one-hour window', () => {
    const now = jerusalemDateTime('2026-07-10', '17:30');
    expect(getMatchDisplayStatus(kickoffIso, now)).toBe('live');
  });

  it('returns finished after kickoff plus 60 minutes', () => {
    const now = jerusalemDateTime('2026-07-10', '18:01');
    expect(getMatchDisplayStatus(kickoffIso, now)).toBe('finished');
  });

  it('returns upcoming for invalid match date', () => {
    expect(getMatchDisplayStatus('not-a-date')).toBe('upcoming');
  });

  it('returns finished for technical win regardless of kickoff time', () => {
    const now = jerusalemDateTime('2026-07-10', '16:30');
    expect(getMatchDisplayStatus(kickoffIso, now, 1)).toBe('finished');
    expect(getMatchDisplayStatus(kickoffIso, now, 2)).toBe('finished');
  });
});

describe('shouldCountMatchInStats', () => {
  const kickoffIso = jerusalemDateTime('2026-07-10', '17:00').toISOString();
  const scoredMatch = { date: kickoffIso, score1: 0, score2: 0 };

  it('is false before kickoff even with a 0-0 score stored', () => {
    const now = jerusalemDateTime('2026-07-10', '16:30');
    expect(shouldCountMatchInStats(scoredMatch, now)).toBe(false);
  });

  it('is true during the live window', () => {
    const now = jerusalemDateTime('2026-07-10', '17:30');
    expect(shouldCountMatchInStats(scoredMatch, now)).toBe(true);
  });

  it('is true after full-time with scores set', () => {
    const now = jerusalemDateTime('2026-07-10', '18:01');
    expect(shouldCountMatchInStats(scoredMatch, now)).toBe(true);
    expect(shouldCountMatchInStats({ date: kickoffIso, score1: 2, score2: 1 }, now)).toBe(true);
  });

  it('is false when scores are missing', () => {
    const now = jerusalemDateTime('2026-07-10', '18:01');
    expect(shouldCountMatchInStats({ date: kickoffIso, score1: null, score2: null }, now)).toBe(
      false
    );
  });

  it('is true before kickoff when technical winner is set', () => {
    const now = jerusalemDateTime('2026-07-10', '16:30');
    expect(
      shouldCountMatchInStats(
        { date: kickoffIso, score1: 0, score2: 0, technicalWinnerTeamId: 1 },
        now
      )
    ).toBe(true);
  });
});

describe('isTournamentPollingWindow', () => {
  it('is false on Thursday evening', () => {
    const now = jerusalemDateTime('2026-07-09', '18:00');
    expect(isTournamentPollingWindow(now)).toBe(false);
  });

  it('is false on Friday before 16:00', () => {
    const now = jerusalemDateTime('2026-07-10', '15:59');
    expect(isTournamentPollingWindow(now)).toBe(false);
  });

  it('is true on Friday at exactly 16:00', () => {
    const now = jerusalemDateTime('2026-07-10', '16:00');
    expect(isTournamentPollingWindow(now)).toBe(true);
  });

  it('is true on Friday during the window', () => {
    const now = jerusalemDateTime('2026-07-10', '17:00');
    expect(isTournamentPollingWindow(now)).toBe(true);
  });

  it('is true on Friday at 20:30', () => {
    const now = jerusalemDateTime('2026-07-10', '20:30');
    expect(isTournamentPollingWindow(now)).toBe(true);
  });

  it('is false at or after 21:00', () => {
    const now = jerusalemDateTime('2026-07-10', '21:00');
    expect(isTournamentPollingWindow(now)).toBe(false);
  });

  it('is true on Saturday during the window', () => {
    const now = jerusalemDateTime('2026-07-11', '18:00');
    expect(isTournamentPollingWindow(now)).toBe(true);
  });
});

describe('shouldPollTournamentData', () => {
  const fridayMatch = {
    date: jerusalemDateTime('2026-07-10', '17:00').toISOString(),
  };

  it('requires a match on today Jerusalem date', () => {
    const now = jerusalemDateTime('2026-07-10', '17:00');
    expect(shouldPollTournamentData([fridayMatch], now)).toBe(true);
    expect(shouldPollTournamentData([], now)).toBe(false);
  });

  it('is false outside the polling window even with a match today', () => {
    const now = jerusalemDateTime('2026-07-10', '15:00');
    expect(shouldPollTournamentData([fridayMatch], now)).toBe(false);
  });
});

describe('hasMatchOnJerusalemDate', () => {
  it('matches Jerusalem calendar day, not UTC day', () => {
    const match = { date: jerusalemDateTime('2026-07-10', '17:00').toISOString() };
    const now = jerusalemDateTime('2026-07-10', '12:00');
    expect(hasMatchOnJerusalemDate([match], now)).toBe(true);
    expect(hasMatchOnJerusalemDate([match], jerusalemDateTime('2026-07-11', '12:00'))).toBe(
      false
    );
  });
});

describe('needsMatchStatusClockTick', () => {
  const kickoffIso = jerusalemDateTime('2026-07-10', '17:00').toISOString();

  it('is true shortly before kickoff', () => {
    const now = jerusalemDateTime('2026-07-10', '16:59');
    expect(needsMatchStatusClockTick([{ date: kickoffIso }], now)).toBe(true);
  });

  it('is false hours before kickoff', () => {
    const now = jerusalemDateTime('2026-07-10', '12:00');
    expect(needsMatchStatusClockTick([{ date: kickoffIso }], now)).toBe(false);
  });

  it('is true shortly after full-time', () => {
    const now = jerusalemDateTime('2026-07-10', '18:01');
    expect(needsMatchStatusClockTick([{ date: kickoffIso }], now)).toBe(true);
  });
});
