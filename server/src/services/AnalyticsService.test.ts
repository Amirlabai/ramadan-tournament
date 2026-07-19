import { describe, expect, it } from 'vitest';
import {
  CLIENT_EVENT_ALLOWLIST,
  isAllowedAnalyticsEvent,
  sanitizeAnalyticsProperties,
  validateSessionId,
} from './AnalyticsService';

describe('sanitizeAnalyticsProperties', () => {
  it('keeps allowlisted safe keys', () => {
    expect(
      sanitizeAnalyticsProperties({
        division: 'boys',
        teamId: 3,
        method: 'password',
        reason: 'invalid_credentials',
        surface: 'public',
      })
    ).toEqual({
      division: 'boys',
      teamId: 3,
      method: 'password',
      reason: 'invalid_credentials',
      surface: 'public',
    });
  });

  it('strips denied keys and unknown keys', () => {
    expect(
      sanitizeAnalyticsProperties({
        email: 'a@b.com',
        personalId: '123',
        name: 'Alice',
        division: 'boys',
        unknown: 'x',
      })
    ).toEqual({ division: 'boys' });
  });

  it('accepts known surface values', () => {
    expect(sanitizeAnalyticsProperties({ surface: 'admin' })).toEqual({ surface: 'admin' });
    expect(sanitizeAnalyticsProperties({ surface: 'public' })).toEqual({ surface: 'public' });
    expect(sanitizeAnalyticsProperties({ surface: 'schedule' })).toEqual({ surface: 'schedule' });
    expect(sanitizeAnalyticsProperties({ surface: 'dashboard' })).toEqual({ surface: 'dashboard' });
    expect(sanitizeAnalyticsProperties({ surface: 'other' })).toBeUndefined();
  });

  it('keeps share property keys', () => {
    expect(
      sanitizeAnalyticsProperties({
        kind: 'match',
        result: 'shared',
        cached: true,
      })
    ).toEqual({ kind: 'match', result: 'shared', cached: true });
  });

  it('does not block allowlisted keys that contain denied substrings', () => {
    expect(
      sanitizeAnalyticsProperties({
        division: 'boys',
        status: 'active',
      })
    ).toEqual({ division: 'boys', status: 'active' });
  });

  it('returns undefined for empty input', () => {
    expect(sanitizeAnalyticsProperties(null)).toBeUndefined();
    expect(sanitizeAnalyticsProperties({})).toBeUndefined();
  });
});

describe('validateSessionId', () => {
  it('accepts valid session ids', () => {
    expect(validateSessionId('abc12345')).toBe('abc12345');
    expect(validateSessionId('  abc12345  ')).toBe('abc12345');
  });

  it('rejects invalid session ids', () => {
    expect(validateSessionId('short')).toBeNull();
    expect(validateSessionId('')).toBeNull();
    expect(validateSessionId(null)).toBeNull();
  });
});

describe('isAllowedAnalyticsEvent', () => {
  it('accepts known client events', () => {
    expect(isAllowedAnalyticsEvent('page_view', 'client')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('nav_click')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('share_click')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('share_result')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('share_error')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('donation_popup_show')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('donation_popup_cta')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('donation_popup_dismiss')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('albums_discover_show')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('albums_discover_cta')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('albums_discover_dismiss')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('stats_discover_show')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('stats_discover_cta')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('stats_discover_dismiss')).toBe(true);
    expect(CLIENT_EVENT_ALLOWLIST.has('match_expand')).toBe(true);
  });

  it('rejects unknown client events', () => {
    expect(isAllowedAnalyticsEvent('mystery_event', 'client')).toBe(false);
  });

  it('accepts known server events', () => {
    expect(isAllowedAnalyticsEvent('login_success', 'server')).toBe(true);
    expect(isAllowedAnalyticsEvent('logout', 'server')).toBe(true);
  });
});
