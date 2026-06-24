export const TEAM_NAME_MAX_LEN = 80;
export const TEAM_DESC_MAX_LEN = 500;
export const INVOICE_CODE_MAX_LEN = 24;

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;

export function sanitizeTeamCreationFields(
  teamName: string,
  description: string
): { teamName: string; description: string } {
  const name = teamName.trim().slice(0, TEAM_NAME_MAX_LEN);
  const desc = description.trim().slice(0, TEAM_DESC_MAX_LEN);

  if (!name) {
    throw new Error('שם קבוצה נדרש');
  }
  if (CONTROL_CHARS.test(name) || CONTROL_CHARS.test(desc)) {
    throw new Error('שם או תיאור הקבוצה מכילים תווים לא חוקיים');
  }

  return { teamName: name, description: desc };
}

export function parsePositiveTeamId(raw: string | number): number {
  const trimmed = String(raw).trim();
  const teamId = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(teamId) || teamId < 1 || String(teamId) !== trimmed) {
    throw new Error('מזהה קבוצה לא תקין');
  }
  return teamId;
}
