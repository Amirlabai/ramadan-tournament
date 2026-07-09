/** Circassian summer tournament rules apply to the boys branch only (not girls or FIFA World Cup UI). */
export function showBoysTournamentRulesNav(isGirls: boolean, isWorldCup: boolean): boolean {
  return !isGirls && !isWorldCup
}
