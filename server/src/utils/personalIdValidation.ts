import { encryptPersonalId } from './personalIdCrypto';

export const BIRTH_YEAR_MIN = 1940;
export const BIRTH_YEAR_MAX = 2015;

export function normalizePersonalId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5 || digits.length > 9) {
    throw new Error('תעודת זהות חייבת להכיל 5–9 ספרות');
  }
  return digits;
}

export function parseBirthYear(raw: string | number): number {
  const year = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
  if (!Number.isInteger(year) || year < BIRTH_YEAR_MIN || year > BIRTH_YEAR_MAX) {
    throw new Error(`שנת לידה חייבת להיות בין ${BIRTH_YEAR_MIN} ל-${BIRTH_YEAR_MAX}`);
  }
  return year;
}

export function maskPersonalId(normalized: string): string {
  if (normalized.length <= 4) {
    return '*'.repeat(normalized.length);
  }
  return '*'.repeat(normalized.length - 4) + normalized.slice(-4);
}

export function encryptPersonalIdForStorage(normalized: string): string {
  return encryptPersonalId(normalized);
}

export function identitiesMatch(
  userEnc: string | null | undefined,
  userYear: number | null | undefined,
  adminEnc: string | null | undefined,
  adminYear: number | null | undefined
): boolean {
  return (
    !!userEnc &&
    !!adminEnc &&
    userYear != null &&
    adminYear != null &&
    userEnc === adminEnc &&
    userYear === adminYear
  );
}
