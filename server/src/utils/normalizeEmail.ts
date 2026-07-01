const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * Normalizes an email address for lookup and storage:
 * - lowercase and trim
 * - strip subaddressing (user+tag@domain → user@domain)
 * - Gmail: remove dots in local part; googlemail.com → gmail.com
 * Returns null for malformed addresses (not exactly one `@` with non-empty local and domain).
 */
export function normalizeEmail(email: string): string | null {
  const trimmed = email.toLowerCase().trim();
  const parts = trimmed.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let [local, domain] = parts;
  local = local.split('+')[0];

  if (GMAIL_DOMAINS.has(domain)) {
    domain = 'gmail.com';
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}
