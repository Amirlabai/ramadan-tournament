/** Empty / N/A sentinels shown in UI cells (legacy em dash + ASCII hyphen). */
export const EMPTY_DISPLAY_SENTINELS = new Set(['—', '-']);

export function isEmptyDisplayValue(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  return !trimmed || EMPTY_DISPLAY_SENTINELS.has(trimmed);
}

/** Map null / blank / legacy `—` to ASCII `-` for product UI. */
export function displayOrDash(
  value: string | null | undefined,
  fallback = '-'
): string {
  if (isEmptyDisplayValue(value)) return fallback;
  return value!.trim();
}
