import { BIRTH_YEAR_MAX, BIRTH_YEAR_MIN, isValidIsraeliId } from '@ramadan-tournament/shared';
import { normalizePersonalId, parseBirthYear } from './personalIdValidation';

export type FormIdentityPartial = 'missing_id' | 'missing_birth_year';

export type ParseFormIdentityResult = {
  personalId?: string;
  birthYear?: number;
  partial?: FormIdentityPartial;
};

export type ValidateFormIdentityResult =
  | { ok: true; personalId: string; birthYear: number }
  | { ok: false; reason: string };

const DATE_TOKEN =
  /(\d{1,2})[./\-/](\d{1,2})[./\-/](\d{2,4})/g;

function expandTwoDigitYear(yy: number): number {
  if (yy <= 30) return 2000 + yy;
  return 1900 + yy;
}

function yearInBounds(year: number): boolean {
  return year >= BIRTH_YEAR_MIN && year <= BIRTH_YEAR_MAX;
}

/** Extract birth year from a date token string; returns null if unparseable or out of bounds. */
export function extractBirthYearFromDate(token: string): number | null {
  if (!token?.trim()) return null;

  const trimmed = token.trim();

  const fourDigitOnly = /^\d{4}$/.exec(trimmed);
  if (fourDigitOnly) {
    const year = parseInt(fourDigitOnly[0], 10);
    return yearInBounds(year) ? year : null;
  }

  const normalized = trimmed
    .replace(/ת\.?\s*ז[.:]?\s*/gi, '')
    .replace(/תאריך\s*לידה[.:]?\s*/gi, '')
    .trim();

  const match = /(\d{1,2})[./\-/](\d{1,2})[./\-/](\d{2,4})/.exec(normalized);
  if (!match) return null;

  let year = parseInt(match[3]!, 10);
  if (match[3]!.length === 2) {
    year = expandTwoDigitYear(year);
  }
  return yearInBounds(year) ? year : null;
}

/** Captain birth column: plain year or full date string. */
export function parseCaptainBirthYear(raw: string): number | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();

  if (/^\d{4}$/.test(trimmed)) {
    const year = parseInt(trimmed, 10);
    return yearInBounds(year) ? year : null;
  }

  return extractBirthYearFromDate(trimmed);
}

/** Collect valid 9-digit Israeli IDs from text; ignores 10-digit phone numbers. */
export function findPersonalIdCandidates(raw: string): string[] {
  if (!raw?.trim()) return [];

  const digitsOnly = raw.replace(/\D/g, ' ');
  const candidates = new Set<string>();

  for (const chunk of digitsOnly.split(/\s+/)) {
    if (!chunk) continue;
    if (chunk.length === 10 && chunk.startsWith('0')) continue;
    if (chunk.length === 9 && isValidIsraeliId(chunk)) {
      candidates.add(chunk);
    }
    if (chunk.length > 9) {
      for (let i = 0; i <= chunk.length - 9; i++) {
        const sub = chunk.slice(i, i + 9);
        if (isValidIsraeliId(sub)) candidates.add(sub);
      }
    }
  }

  return [...candidates];
}

function stripHebrewLabels(raw: string): string {
  return raw
    .replace(/ת\.?\s*ז[.:]?\s*/gi, ' ')
    .replace(/תאריך\s*לידה[.:]?\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDateYears(raw: string): number[] {
  const years: number[] = [];
  const cleaned = stripHebrewLabels(raw);
  let m: RegExpExecArray | null;
  const re = new RegExp(DATE_TOKEN.source, 'g');
  while ((m = re.exec(cleaned)) !== null) {
    const token = m[0];
    const year = extractBirthYearFromDate(token);
    if (year != null) years.push(year);
  }
  if (years.length === 0) {
    const y = extractBirthYearFromDate(cleaned);
    if (y != null) years.push(y);
  }
  return years;
}

/** Parse combined GK/player identity cell from Google Form CSV. Never throws. */
export function parseFormIdentityField(raw: string): ParseFormIdentityResult | null {
  if (!raw?.trim()) return null;

  const cleaned = stripHebrewLabels(raw);
  const ids = findPersonalIdCandidates(cleaned);
  const years = extractDateYears(cleaned);

  if (ids.length > 0 && years.length > 0) {
    return { personalId: ids[0], birthYear: years[0] };
  }
  if (ids.length > 0) {
    return { personalId: ids[0], partial: 'missing_birth_year' };
  }
  if (years.length > 0) {
    return { birthYear: years[0], partial: 'missing_id' };
  }
  return null;
}

export function validateFormIdentity(
  personalId: string,
  birthYear: number
): ValidateFormIdentityResult {
  try {
    const normalized = normalizePersonalId(personalId);
    const year = parseBirthYear(birthYear);
    return { ok: true, personalId: normalized, birthYear: year };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'פרטים לא תקינים';
    if (reason.includes('תקינות') || reason.includes('9 ספרות')) {
      return { ok: false, reason: 'invalid_luhn' };
    }
    if (reason.includes('שנת לידה')) {
      return { ok: false, reason: 'birth_year_out_of_range' };
    }
    return { ok: false, reason };
  }
}

export function validatePersonalIdOnly(personalId: string): ValidateFormIdentityResult {
  try {
    const normalized = normalizePersonalId(personalId);
    return { ok: true, personalId: normalized, birthYear: 0 };
  } catch {
    return { ok: false, reason: 'invalid_luhn' };
  }
}

export function validateBirthYearOnly(birthYear: number): ValidateFormIdentityResult {
  try {
    const year = parseBirthYear(birthYear);
    return { ok: true, personalId: '', birthYear: year };
  } catch {
    return { ok: false, reason: 'birth_year_out_of_range' };
  }
}
