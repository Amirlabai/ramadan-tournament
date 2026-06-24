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

/** Compare two normalized invoice numbers (same normalization applied upstream). */
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

export const INVOICE_ALERT_SIMILAR =
  'המנהל רשם במערכת חשבונית דומה לשלך. ודא שמספר החשבונית שהזנת נכון; אם יש טעות — עדכן למטה או פנה למנהל.';

export const INVOICE_ALERT_MISMATCH =
  'מספר החשבונית שהמנהל רשם במערכת שונה מה שהזנת. בדוק את המספר, עדכן למטה או פנה למנהל.';

export const INVOICE_ALERT_USER_DIFFERS_FROM_ADMIN =
  'הזנת חשבונית שונה ממה שהוקצה עבורך על ידי המנהל. ודא שהמספר נכון.';

export const INVOICE_ALERT_USER_SIMILAR_TO_ADMIN =
  'הזנת חשבונית דומה למה שהוקצה עבורך על ידי המנהל. ודא שאין טעות בהקלדה.';
