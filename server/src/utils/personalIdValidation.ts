import { encryptPersonalId } from './personalIdCrypto';
import {
  BIRTH_YEAR_MIN,
  BIRTH_YEAR_MAX,
  isValidIsraeliId,
  normalizePersonalId,
} from '@ramadan-tournament/shared';

export { isValidIsraeliId, normalizePersonalId };
export { BIRTH_YEAR_MIN, BIRTH_YEAR_MAX };

export function parseBirthYear(raw: string | number): number {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < BIRTH_YEAR_MIN || raw > BIRTH_YEAR_MAX) {
      throw new Error(`שנת לידה חייבת להיות בין ${BIRTH_YEAR_MIN} ל-${BIRTH_YEAR_MAX}`);
    }
    return raw;
  }
  const s = String(raw).trim();
  if (!/^\d{4}$/.test(s)) {
    throw new Error(`שנת לידה חייבת להיות 4 ספרות בין ${BIRTH_YEAR_MIN} ל-${BIRTH_YEAR_MAX}`);
  }
  const year = parseInt(s, 10);
  if (year < BIRTH_YEAR_MIN || year > BIRTH_YEAR_MAX) {
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
