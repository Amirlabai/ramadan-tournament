export {
  BIRTH_YEAR_MIN,
  BIRTH_YEAR_MAX,
  isBirthYearInRange,
} from '@ramadan-tournament/shared/birthYearBounds';

export function sanitizeBirthYearInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}
