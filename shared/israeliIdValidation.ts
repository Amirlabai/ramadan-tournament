/** Israeli teudat zehut checksum (Luhn variant). Exactly 9 digits — no leading-zero padding. */

export function isValidIsraeliId(idNumber: string): boolean {
  const s = idNumber.trim().split('.')[0].replace(/\D/g, '');
  if (!/^\d{9}$/.test(s) || parseInt(s, 10) <= 0) {
    return false;
  }

  let totalSum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(s[i]!, 10);
    const weight = (i % 2) + 1;
    const processed = digit * weight;
    if (processed > 9) {
      totalSum += Math.floor(processed / 10) + (processed % 10);
    } else {
      totalSum += processed;
    }
  }
  return totalSum % 10 === 0;
}

export function normalizePersonalId(raw: string): string {
  const digits = raw.trim().split('.')[0].replace(/\D/g, '');
  if (!/^\d{9}$/.test(digits)) {
    throw new Error('תעודת זהות חייבת להכיל בדיוק 9 ספרות');
  }
  if (!isValidIsraeliId(digits)) {
    throw new Error('מספר תעודת זהות לא עובר בדיקת תקינות');
  }
  return digits;
}

export function sanitizePersonalIdInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 9);
}
