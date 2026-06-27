import { describe, expect, it } from 'vitest';
import { addDaysToDateString, jerusalemDateTime } from './jerusalemDate';

describe('addDaysToDateString', () => {
  it('adds calendar days', () => {
    expect(addDaysToDateString('2026-06-15', 1)).toBe('2026-06-16');
    expect(addDaysToDateString('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('subtracts days', () => {
    expect(addDaysToDateString('2026-03-01', -1)).toBe('2026-02-28');
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
