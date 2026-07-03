import { describe, expect, it } from 'vitest';
import {
  aggregateDwellStats,
  buildActivityLabel,
  buildProcessMap,
  buildTracesFromRows,
  buildVariants,
  DEFAULT_IDLE_CAP_MS,
  excludeAdminTaintedSessions,
  isAdminAnalyticsEvent,
  type AnalyticsEventRow,
} from './AnalyticsQueryService';

function row(
  partial: Partial<AnalyticsEventRow> & Pick<AnalyticsEventRow, 'eventName' | 'createdAt'>
): AnalyticsEventRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    sessionId: partial.sessionId ?? 'session-abcdef12',
    category: partial.category ?? 'browse',
    source: partial.source ?? 'client',
    path: partial.path ?? null,
    properties: partial.properties ?? null,
    ...partial,
  };
}

describe('buildActivityLabel', () => {
  it('normalizes page_view with path', () => {
    expect(buildActivityLabel({ eventName: 'page_view', path: '/teams', properties: null })).toBe(
      'page: /teams'
    );
  });

  it('normalizes nav_click with navTo', () => {
    expect(
      buildActivityLabel({
        eventName: 'nav_click',
        path: '/',
        properties: { navTo: '/profile' },
      })
    ).toBe('nav: /profile');
  });

  it('uses event name for server events', () => {
    expect(
      buildActivityLabel({ eventName: 'login_success', path: '/login', properties: null })
    ).toBe('login_success');
  });
});

describe('isAdminAnalyticsEvent', () => {
  it('flags page_view on /admin', () => {
    expect(isAdminAnalyticsEvent({ eventName: 'page_view', path: '/admin', properties: null })).toBe(
      true
    );
  });

  it('flags page_view on /admin/login', () => {
    expect(
      isAdminAnalyticsEvent({ eventName: 'page_view', path: '/admin/login', properties: null })
    ).toBe(true);
  });

  it('does not flag public page_view', () => {
    expect(isAdminAnalyticsEvent({ eventName: 'page_view', path: '/teams', properties: null })).toBe(
      false
    );
  });

  it('flags nav_click to /admin from another path', () => {
    expect(
      isAdminAnalyticsEvent({
        eventName: 'nav_click',
        path: '/profile',
        properties: { navTo: '/admin' },
      })
    ).toBe(true);
  });

  it('flags auth with surface admin', () => {
    expect(
      isAdminAnalyticsEvent({
        eventName: 'login_submit',
        path: '/admin/login',
        properties: { surface: 'admin' },
      })
    ).toBe(true);
  });

  it('does not flag public auth on /login', () => {
    expect(
      isAdminAnalyticsEvent({
        eventName: 'login_submit',
        path: '/login',
        properties: { surface: 'public' },
      })
    ).toBe(false);
  });
});

describe('excludeAdminTaintedSessions', () => {
  const base = new Date('2026-07-01T10:00:00Z');

  it('keeps sessions with only public browsing', () => {
    const rows = [
      row({ sessionId: 'sess-public1', eventName: 'page_view', path: '/', createdAt: base }),
      row({
        sessionId: 'sess-public1',
        eventName: 'page_view',
        path: '/teams',
        createdAt: new Date(base.getTime() + 1000),
      }),
      row({ sessionId: 'sess-public2', eventName: 'page_view', path: '/stats', createdAt: base }),
    ];

    const filtered = excludeAdminTaintedSessions(rows);
    expect(filtered).toHaveLength(3);
    expect(buildTracesFromRows(filtered)).toHaveLength(2);
  });

  it('drops entire session when any admin event appears', () => {
    const rows = [
      row({ sessionId: 'sess-admin01', eventName: 'page_view', path: '/', createdAt: base }),
      row({
        sessionId: 'sess-admin01',
        eventName: 'nav_click',
        path: '/',
        properties: { navTo: '/admin' },
        createdAt: new Date(base.getTime() + 1000),
      }),
      row({
        sessionId: 'sess-admin01',
        eventName: 'page_view',
        path: '/admin',
        createdAt: new Date(base.getTime() + 2000),
      }),
      row({
        sessionId: 'sess-admin01',
        eventName: 'page_view',
        path: '/teams',
        createdAt: new Date(base.getTime() + 3000),
      }),
    ];

    const filtered = excludeAdminTaintedSessions(rows);
    expect(filtered).toHaveLength(0);
    expect(buildTracesFromRows(filtered)).toHaveLength(0);
  });

  it('does not taint other sessions in the same batch', () => {
    const rows = [
      row({ sessionId: 'sess-public1', eventName: 'page_view', path: '/teams', createdAt: base }),
      row({ sessionId: 'sess-admin01', eventName: 'page_view', path: '/admin', createdAt: base }),
    ];

    const filtered = excludeAdminTaintedSessions(rows);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessionId).toBe('sess-public1');
  });
});

describe('buildTracesFromRows', () => {
  it('orders events per session by created_at', () => {
    const t0 = new Date('2026-07-01T10:00:00Z');
    const t1 = new Date('2026-07-01T10:01:00Z');
    const traces = buildTracesFromRows([
      row({ sessionId: 'sess-aaaaaaa1', eventName: 'page_view', path: '/teams', createdAt: t1 }),
      row({ sessionId: 'sess-aaaaaaa1', eventName: 'page_view', path: '/', createdAt: t0 }),
    ]);

    expect(traces).toHaveLength(1);
    expect(traces[0].steps.map((s) => s.label)).toEqual(['page: /', 'page: /teams']);
  });

  it('excludes rows without session_id', () => {
    const traces = buildTracesFromRows([
      row({ sessionId: null, eventName: 'page_view', path: '/', createdAt: new Date() }),
    ]);
    expect(traces).toHaveLength(0);
  });
});

describe('buildProcessMap', () => {
  it('computes dual session and transition counts', () => {
    const base = new Date('2026-07-01T10:00:00Z');
    const traces = buildTracesFromRows([
      row({
        sessionId: 'sess-loop1111',
        eventName: 'page_view',
        path: '/',
        createdAt: new Date(base.getTime()),
      }),
      row({
        sessionId: 'sess-loop1111',
        eventName: 'page_view',
        path: '/teams',
        createdAt: new Date(base.getTime() + 1000),
      }),
      row({
        sessionId: 'sess-loop1111',
        eventName: 'page_view',
        path: '/',
        createdAt: new Date(base.getTime() + 2000),
      }),
      row({
        sessionId: 'sess-loop1111',
        eventName: 'page_view',
        path: '/teams',
        createdAt: new Date(base.getTime() + 3000),
      }),
    ]);

    const map = buildProcessMap(traces);
    const backEdge = map.edges.find((e) => e.from === 'page: /' && e.to === 'page: /teams');

    expect(backEdge?.sessionCount).toBe(1);
    expect(backEdge?.transitionCount).toBe(2);
  });

  it('filters edges below minEdgeSessions', () => {
    const base = new Date('2026-07-01T10:00:00Z');
    const traces = buildTracesFromRows([
      row({
        sessionId: 'sess-aaaaaaa1',
        eventName: 'page_view',
        path: '/',
        createdAt: base,
      }),
      row({
        sessionId: 'sess-aaaaaaa1',
        eventName: 'login_submit',
        createdAt: new Date(base.getTime() + 1000),
      }),
      row({
        sessionId: 'sess-bbbbbbb2',
        eventName: 'page_view',
        path: '/teams',
        createdAt: base,
      }),
    ]);

    const map = buildProcessMap(traces, { minEdgeSessions: 2 });
    expect(map.edges.every((e) => e.sessionCount >= 2)).toBe(true);
  });
});

describe('aggregateDwellStats', () => {
  it('computes median and mean on valid samples', () => {
    const stats = aggregateDwellStats([1000, 2000, 3000, 4000]);
    expect(stats.median).toBe(2500);
    expect(stats.mean).toBe(2500);
    expect(stats.sampleCount).toBe(4);
    expect(stats.idleCount).toBe(0);
  });

  it('drops zero and negative deltas', () => {
    const stats = aggregateDwellStats([0, -100, 1000, 2000]);
    expect(stats.sampleCount).toBe(2);
    expect(stats.median).toBe(1500);
  });

  it('counts idle samples above cap separately', () => {
    const cap = DEFAULT_IDLE_CAP_MS;
    const stats = aggregateDwellStats([1000, 2000, cap + 1], cap);
    expect(stats.sampleCount).toBe(2);
    expect(stats.idleCount).toBe(1);
    expect(stats.median).toBe(1500);
  });
});

describe('buildProcessMap dwell', () => {
  it('aggregates edge dwell from consecutive created_at pairs', () => {
    const base = new Date('2026-07-01T10:00:00Z');
    const traces = buildTracesFromRows([
      row({
        sessionId: 'sess-dwell111',
        eventName: 'page_view',
        path: '/',
        createdAt: base,
      }),
      row({
        sessionId: 'sess-dwell111',
        eventName: 'login_submit',
        createdAt: new Date(base.getTime() + 5000),
      }),
      row({
        sessionId: 'sess-dwell111',
        eventName: 'login_success',
        createdAt: new Date(base.getTime() + 15000),
      }),
    ]);

    const map = buildProcessMap(traces);
    const toLogin = map.edges.find((e) => e.from === 'page: /' && e.to === 'login_submit');
    const toSuccess = map.edges.find((e) => e.from === 'login_submit' && e.to === 'login_success');

    expect(toLogin?.dwellMs.median).toBe(5000);
    expect(toSuccess?.dwellMs.median).toBe(10000);
  });
});

describe('buildVariants', () => {
  it('ranks variants by session count', () => {
    const base = new Date('2026-07-01T10:00:00Z');
    const traces = buildTracesFromRows([
      row({ sessionId: 'sess-aaaaaaa1', eventName: 'page_view', path: '/', createdAt: base }),
      row({
        sessionId: 'sess-aaaaaaa1',
        eventName: 'page_view',
        path: '/teams',
        createdAt: new Date(base.getTime() + 5000),
      }),
      row({ sessionId: 'sess-bbbbbbb2', eventName: 'page_view', path: '/', createdAt: base }),
      row({
        sessionId: 'sess-bbbbbbb2',
        eventName: 'page_view',
        path: '/teams',
        createdAt: new Date(base.getTime() + 5000),
      }),
      row({ sessionId: 'sess-cccccccc3', eventName: 'page_view', path: '/stats', createdAt: base }),
    ]);

    const variants = buildVariants(traces);
    expect(variants[0].sessionCount).toBe(2);
    expect(variants[0].sequence).toEqual(['page: /', 'page: /teams']);
    expect(variants[0].medianDurationMs).toBe(5000);
  });
});
