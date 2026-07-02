import { describe, expect, it } from 'vitest';
import {
  addDaysToDateString,
  getNthAllowedMatchDate,
  getWeekdayFromDateString,
  jerusalemDateTime,
} from './jerusalemDate';

describe('addDaysToDateString', () => {
  it('adds calendar days', () => {
    expect(addDaysToDateString('2026-06-15', 1)).toBe('2026-06-16');
    expect(addDaysToDateString('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('subtracts days', () => {
    expect(addDaysToDateString('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('getWeekdayFromDateString', () => {
  it('returns UTC weekday for calendar date', () => {
    expect(getWeekdayFromDateString('2026-07-10')).toBe(5); // Fri
    expect(getWeekdayFromDateString('2026-07-11')).toBe(6); // Sat
    expect(getWeekdayFromDateString('2026-07-12')).toBe(0); // Sun
  });
});

describe('getNthAllowedMatchDate', () => {
  const friSat = [5, 6];

  it('returns Fri/Sat sequence from a Friday start', () => {
    expect(getNthAllowedMatchDate('2026-07-10', 0, friSat)).toBe('2026-07-10');
    expect(getNthAllowedMatchDate('2026-07-10', 1, friSat)).toBe('2026-07-11');
    expect(getNthAllowedMatchDate('2026-07-10', 2, friSat)).toBe('2026-07-17');
  });

  it('skips to next Friday when start is Thursday', () => {
    expect(getNthAllowedMatchDate('2026-07-09', 0, friSat)).toBe('2026-07-10');
  });
});

describe('jerusalemDateTime', () => {
  it('maps wall-clock Jerusalem time to UTC', () => {
    const dt = jerusalemDateTime('2026-06-15', '12:00');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    expect(get('year')).toBe('2026');
    expect(get('month')).toBe('06');
    expect(get('day')).toBe('15');
    expect(get('hour')).toBe('12');
    expect(get('minute')).toBe('00');
  });
});
