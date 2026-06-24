const BYE = -1;

/** Single round-robin pairings via circle method; skips bye slots. */
export function singleRoundRobinPairs(teamIds: number[]): [number, number][] {
  if (teamIds.length < 2) {
    return [];
  }

  const ids = [...teamIds];
  if (ids.length % 2 === 1) {
    ids.push(BYE);
  }

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const pairs: [number, number][] = [];
  const rotating = [...ids];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const t1 = rotating[i];
      const t2 = rotating[n - 1 - i];
      if (t1 !== BYE && t2 !== BYE) {
        pairs.push([t1, t2]);
      }
    }
    const fixed = rotating[0];
    const rest = rotating.slice(1);
    const last = rest.pop()!;
    rest.unshift(last);
    rotating.splice(0, n, fixed, ...rest);
  }

  return pairs;
}
