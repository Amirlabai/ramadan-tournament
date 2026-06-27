import { TEAM_DESC_MAX_LEN, TEAM_NAME_MAX_LEN } from '@ramadan-tournament/shared';

export { TEAM_DESC_MAX_LEN, TEAM_NAME_MAX_LEN };
export const INVOICE_CODE_MAX_LEN = 24;

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;

export function sanitizeTeamDescription(description: string): string {
  const desc = description.trim().slice(0, TEAM_DESC_MAX_LEN);
  if (CONTROL_CHARS.test(desc)) {
    throw new Error('תיאור הקבוצה מכיל תווים לא חוקיים');
  }
  return desc;
}

export function sanitizeTeamName(name: string): string {
  const trimmed = name.trim().slice(0, TEAM_NAME_MAX_LEN);
  if (!trimmed) {
    throw new Error('שם קבוצה נדרש');
  }
  if (CONTROL_CHARS.test(trimmed)) {
    throw new Error('שם הקבוצה מכיל תווים לא חוקיים');
  }
  return trimmed;
}

export function sanitizeTeamCreationFields(
  teamName: string,
  description: string
): { teamName: string; description: string } {
  return {
    teamName: sanitizeTeamName(teamName),
    description: sanitizeTeamDescription(description),
  };
}

export function parsePositiveTeamId(raw: string | number): number {
  const trimmed = String(raw).trim();
  const teamId = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(teamId) || teamId < 1 || String(teamId) !== trimmed) {
    throw new Error('מזהה קבוצה לא תקין');
  }
  return teamId;
}
