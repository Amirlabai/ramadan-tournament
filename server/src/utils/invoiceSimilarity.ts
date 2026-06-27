export type InvoiceMatchKind = 'exact' | 'similar' | 'mismatch';

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[n];
}

/** Strict match for user-facing good / not-good (no fuzzy tier). */
export function invoicesMatchExactly(a: string, b: string): boolean {
  return a === b;
}

/** Fuzzy compare — admin duplicate detection across users only. */
export function classifyInvoiceMatch(a: string, b: string): InvoiceMatchKind {
  if (a === b) {
    return 'exact';
  }

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshtein(a, b);

  if (distance <= 1) {
    return 'similar';
  }
  if (maxLen >= 6 && distance / maxLen <= 0.2) {
    return 'similar';
  }
  if (maxLen >= 4 && distance <= 2) {
    return 'similar';
  }

  return 'mismatch';
}

export const INVOICE_ALERT_NOT_MATCHING =
  'תעודת הזהות או שנת הלידה לא תואמים. נסה שוב או פנה למנהל.';
