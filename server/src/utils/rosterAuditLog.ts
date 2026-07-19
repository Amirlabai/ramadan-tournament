import { isEmptyDisplayValue } from '@ramadan-tournament/shared';

export type RosterAuditEvent =
  | 'player_profile_position_changed'
  | 'roster_member_deactivate_start'
  | 'roster_member_deactivate_done'
  | 'admin_join_approved'
  | 'admin_join_rejected'
  | 'admin_join_approve_failed'
  | 'owner_join_approved'
  | 'owner_join_approve_failed';

/** Structured roster workflow logs for post-incident tracing (stdout). */
export function rosterAudit(
  event: RosterAuditEvent,
  payload: Record<string, unknown>
): void {
  console.log(
    '[roster-audit]',
    JSON.stringify({
      event,
      at: new Date().toISOString(),
      ...payload,
    })
  );
}

/** Empty string means "unchanged" — do not wipe an existing profile/roster value. */
export function mergeProfilePosition(
  raw: string | undefined,
  existing: string,
  maxLen = 30
): string {
  if (raw === undefined) return existing;
  const trimmed = String(raw).trim();
  if (isEmptyDisplayValue(trimmed)) return existing;
  return trimmed.slice(0, maxLen);
}
