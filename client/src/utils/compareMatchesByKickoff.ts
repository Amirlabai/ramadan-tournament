/** Kickoff ascending, then match id — shared by Dashboard and Schedule. */
export function compareMatchesByKickoff(
  a: { date: string; id: number },
  b: { date: string; id: number }
): number {
  const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (byDate !== 0) return byDate;
  return a.id - b.id;
}
