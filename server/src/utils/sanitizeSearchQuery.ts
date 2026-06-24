/** Prisma `contains` / LIKE patterns — strip wildcards and cap length. */
export function sanitizeSearchQuery(raw: string, maxLen = 100): string {
  return raw.trim().slice(0, maxLen).replace(/[%_\\]/g, '');
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
