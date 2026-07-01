import type { FormPreregFullEntry, FormPreregPartialEntry } from './parseAdigaFormCsv';

/**
 * Form CSV import contract (prereg + roster):
 * - Postgres is source of truth; CSV fills gaps only.
 * - Never delete, update, or replace existing DB rows.
 * - Insert only when no matching team, player, or prereg entry exists.
 */

export type ParsedFormPerson =
  | (FormPreregFullEntry & { kind: 'full' })
  | (FormPreregPartialEntry & { kind: 'partial' });

export function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function splitFormPersonName(name: string): {
  firstName: string;
  lastName: string;
  nickname: string;
} {
  const normalized = normalizePersonName(name);
  const parts = normalized.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: '', nickname: parts[0]! };
  }
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(' '),
    nickname: normalized,
  };
}

export function personTeamRoleKey(teamName: string, name: string, role: string): string {
  return `${teamName.trim()}|${normalizePersonName(name)}|${role}`;
}

export function identityKey(personalIdEnc: string, birthYear: number): string {
  return `${personalIdEnc}:${birthYear}`;
}

export function flattenParsedFormPeople(
  full: FormPreregFullEntry[],
  partial: FormPreregPartialEntry[]
): ParsedFormPerson[] {
  return [
    ...full.map((entry) => ({ ...entry, kind: 'full' as const })),
    ...partial.map((entry) => ({ ...entry, kind: 'partial' as const })),
  ];
}

export type PreregMergeSkipReason =
  | 'already_in_database'
  | 'linked_roster_player';

/** Skip prereg insert when Postgres already has a matching row or a linked roster identity. */
export function shouldSkipPreregInsertWithKeys(
  entry: ParsedFormPerson,
  existingRoleKeys: Set<string>,
  existingFullIdentityKeys: Set<string>,
  existingPartialIdKeys: Set<string>,
  existingPartialYearKeys: Set<string>,
  linkedIdentityKeys: Set<string>,
  encryptId: (plain: string) => string
): PreregMergeSkipReason | null {
  const teamName = entry.teamName.trim();
  const roleKey = personTeamRoleKey(teamName, entry.name, entry.role);

  if (entry.kind === 'full') {
    const idEnc = encryptId(entry.personalId);
    const idKey = identityKey(idEnc, entry.birthYear);
    if (linkedIdentityKeys.has(idKey) || linkedIdentityKeys.has(idEnc)) {
      return 'linked_roster_player';
    }
    if (existingFullIdentityKeys.has(idKey)) return 'already_in_database';
    if (existingRoleKeys.has(roleKey)) return 'already_in_database';
    return null;
  }

  if (entry.personalId) {
    const idEnc = encryptId(entry.personalId);
    if (linkedIdentityKeys.has(idEnc)) return 'linked_roster_player';
    if (existingPartialIdKeys.has(idEnc)) return 'already_in_database';
  }

  if (entry.birthYear != null) {
    const yearKey = `${teamName}|${normalizePersonName(entry.name)}|${entry.birthYear}|${entry.role}`;
    if (existingPartialYearKeys.has(yearKey)) return 'already_in_database';
  }

  if (existingRoleKeys.has(roleKey)) return 'already_in_database';

  return null;
}

export type ExistingRosterPlayer = {
  memberId: number;
  teamId: number;
  teamName: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  nickname: string;
  personalIdEnc: string | null;
  birthYear: number | null;
};

export type RosterMergeSkipReason = 'already_in_database' | 'linked_user';

export function rosterDisplayNames(p: ExistingRosterPlayer): string[] {
  const names = new Set<string>();
  const full = normalizePersonName(`${p.firstName} ${p.lastName}`.trim());
  if (full) names.add(full);
  if (p.nickname.trim()) names.add(normalizePersonName(p.nickname));
  if (!p.lastName.trim() && p.firstName.trim()) {
    names.add(normalizePersonName(p.firstName));
  }
  return [...names];
}

/** Skip roster insert when Postgres already has this player on the team or a linked user owns the slot. */
export function shouldSkipRosterInsert(
  entry: ParsedFormPerson,
  teamName: string,
  teamId: number | undefined,
  existingPlayers: ExistingRosterPlayer[],
  linkedIdentityKeys: Set<string>,
  encryptId: (plain: string) => string
): RosterMergeSkipReason | null {
  const normalizedName = normalizePersonName(entry.name);
  const teamPlayers = teamId
    ? existingPlayers.filter((p) => p.teamId === teamId)
    : existingPlayers.filter((p) => p.teamName.trim() === teamName.trim());

  if (entry.kind === 'full') {
    const idEnc = encryptId(entry.personalId);
    const idKey = identityKey(idEnc, entry.birthYear);
    if (linkedIdentityKeys.has(idKey) || linkedIdentityKeys.has(idEnc)) return 'linked_user';

    const byIdentity = teamPlayers.find(
      (p) =>
        p.personalIdEnc === idEnc &&
        p.birthYear != null &&
        p.birthYear === entry.birthYear
    );
    if (byIdentity) {
      return byIdentity.userId ? 'linked_user' : 'already_in_database';
    }
  }

  if (entry.personalId) {
    const idEnc = encryptId(entry.personalId);
    if (linkedIdentityKeys.has(idEnc)) return 'linked_user';
    const byId = teamPlayers.find((p) => p.personalIdEnc === idEnc);
    if (byId) return byId.userId ? 'linked_user' : 'already_in_database';
  }

  for (const p of teamPlayers) {
    if (p.userId && rosterDisplayNames(p).includes(normalizedName)) return 'linked_user';
  }

  const byName = teamPlayers.find((p) => rosterDisplayNames(p).includes(normalizedName));
  if (byName) {
    return byName.userId ? 'linked_user' : 'already_in_database';
  }

  return null;
}

export function nextJerseyNumber(used: number[]): number {
  const taken = new Set(used.filter((n) => n > 0));
  for (let n = 1; n <= 99; n++) {
    if (!taken.has(n)) return n;
  }
  return Math.max(0, ...used) + 1;
}
