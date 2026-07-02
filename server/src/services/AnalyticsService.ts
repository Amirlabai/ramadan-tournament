import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';

export type AnalyticsCategory =
  | 'auth'
  | 'registration'
  | 'browse'
  | 'player_zone'
  | 'interaction';

export type AnalyticsSource = 'client' | 'server';

const DENIED_PROPERTY_KEYS = new Set([
  'email',
  'password',
  'token',
  'personalid',
  'personal_id',
  'phone',
  'address',
  'secret',
  'credential',
  'displayname',
  'username',
  'name',
]);

const ALLOWED_PROPERTY_KEYS = new Set([
  'division',
  'teamId',
  'method',
  'outcome',
  'reason',
  'navTo',
  'matchId',
  'category',
  'status',
  'expanded',
  'surface',
]);

export const CLIENT_EVENT_ALLOWLIST = new Set([
  'page_view',
  'nav_click',
  'team_expand',
  'claim_banner_click',
  'claim_banner_dismiss',
  'login_submit',
  'register_submit',
  'google_login_click',
  'identity_form_open',
  'identity_submit_click',
  'join_request_click',
  'player_zone_login_submit',
  'photo_upload_start',
  'vote_submit',
  'comment_submit',
]);

export const SERVER_EVENT_ALLOWLIST = new Set([
  'register_success',
  'register_failed',
  'verify_success',
  'verify_failed',
  'login_success',
  'login_failed',
  'google_login_success',
  'logout',
  'identity_submitted',
  'identity_mismatch',
  'identity_rate_limited',
  'identity_validation_failed',
  'identity_submit_failed',
  'join_request_submitted',
  'team_creation_submitted',
  'player_zone_login_success',
  'player_zone_login_failed',
  'photo_upload_success',
  'photo_upload_failed',
]);

const SERVER_STDOUT_EVENTS = new Set([
  'register_success',
  'register_failed',
  'verify_success',
  'verify_failed',
  'login_success',
  'login_failed',
  'google_login_success',
  'logout',
  'identity_submitted',
  'identity_mismatch',
  'identity_rate_limited',
  'identity_validation_failed',
  'identity_submit_failed',
  'join_request_submitted',
  'team_creation_submitted',
  'player_zone_login_success',
  'player_zone_login_failed',
  'photo_upload_success',
  'photo_upload_failed',
]);

export type AnalyticsLogInput = {
  eventName: string;
  category: AnalyticsCategory;
  source: AnalyticsSource;
  sessionId?: string | null;
  path?: string | null;
  properties?: Record<string, unknown> | null;
};

function isDeniedPropertyKey(key: string): boolean {
  return DENIED_PROPERTY_KEYS.has(key.toLowerCase());
}

export function sanitizeAnalyticsProperties(
  properties?: Record<string, unknown> | null
): Prisma.InputJsonValue | undefined {
  if (!properties || typeof properties !== 'object') return undefined;

  const safe: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isDeniedPropertyKey(key)) continue;
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (key === 'surface') {
      if (value === 'admin' || value === 'public') {
        safe[key] = value;
      }
      continue;
    }
    if (typeof value === 'string') {
      if (value.length > 200) continue;
      safe[key] = value;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      safe[key] = value;
      continue;
    }
    if (typeof value === 'boolean') {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

export function isAllowedAnalyticsEvent(
  eventName: string,
  source: AnalyticsSource
): boolean {
  const allowlist =
    source === 'client'
      ? CLIENT_EVENT_ALLOWLIST
      : SERVER_EVENT_ALLOWLIST;
  return allowlist.has(eventName);
}

function normalizePath(path?: string | null): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.length > 500) return undefined;
  return trimmed;
}

function normalizeSessionId(sessionId?: string | null): string | undefined {
  if (!sessionId || typeof sessionId !== 'string') return undefined;
  const trimmed = sessionId.trim();
  if (trimmed.length < 8 || trimmed.length > 64) return undefined;
  return trimmed;
}

export function validateSessionId(sessionId: unknown): string | null {
  if (typeof sessionId !== 'string') return null;
  return normalizeSessionId(sessionId) ?? null;
}

const RETENTION_BATCH_SIZE = 1000;
/** 50 batches × 1000 rows = 50k rows/day max; sufficient at current ingest volume. */
const RETENTION_MAX_ITERATIONS = 50;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function pruneOldEventsBatch(cutoff: Date): Promise<number> {
  return prisma.$executeRaw`
    DELETE FROM analytics_events
    WHERE id IN (
      SELECT id FROM analytics_events
      WHERE created_at < ${cutoff}
      LIMIT ${RETENTION_BATCH_SIZE}
    )
  `;
}

async function pruneOldEvents(): Promise<void> {
  const days = config.analyticsRetentionDays;
  if (!days || days <= 0) return;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    for (let i = 0; i < RETENTION_MAX_ITERATIONS; i += 1) {
      const deleted = await pruneOldEventsBatch(cutoff);
      if (deleted === 0) break;
    }
  } catch (err) {
    console.warn('[analytics] retention prune failed', err);
  }
}

let retentionIntervalStarted = false;

function startRetentionInterval(): void {
  if (retentionIntervalStarted || !config.analyticsRetentionDays) return;
  retentionIntervalStarted = true;
  void pruneOldEvents();
  setInterval(() => {
    void pruneOldEvents();
  }, RETENTION_INTERVAL_MS);
}

function mirrorToStdout(input: AnalyticsLogInput, properties?: Prisma.InputJsonValue): void {
  if (input.source !== 'server') return;
  if (!SERVER_STDOUT_EVENTS.has(input.eventName)) return;

  console.info(
    '[analytics]',
    JSON.stringify({
      eventName: input.eventName,
      category: input.category,
      path: input.path ?? null,
      properties: properties ?? null,
    })
  );
}

export class AnalyticsService {
  static log(input: AnalyticsLogInput): void {
    if (!isAllowedAnalyticsEvent(input.eventName, input.source)) return;

    startRetentionInterval();

    const sessionId = normalizeSessionId(input.sessionId);
    const path = normalizePath(input.path);
    const properties = sanitizeAnalyticsProperties(input.properties ?? undefined);

    mirrorToStdout(input, properties);

    void prisma.analyticsEvent
      .create({
        data: {
          eventName: input.eventName,
          category: input.category,
          source: input.source,
          sessionId,
          path,
          properties,
        },
      })
      .catch((err) => {
        console.warn('[analytics] insert failed', err);
      });
  }
}
