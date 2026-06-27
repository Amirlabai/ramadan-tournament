/** Tournament eligibility — keep client and server in sync via this module.
 * 1966–2010 covers youth divisions for Summer 2026; existing roster rows keep stored birth_year
 * and are not re-validated until the user submits identity again (registration / player-zone login).
 */
export const BIRTH_YEAR_MIN = 1966;
export const BIRTH_YEAR_MAX = 2010;

export function isBirthYearInRange(value: string): boolean {
  if (value.length !== 4) return false;
  const year = parseInt(value, 10);
  return year >= BIRTH_YEAR_MIN && year <= BIRTH_YEAR_MAX;
}
