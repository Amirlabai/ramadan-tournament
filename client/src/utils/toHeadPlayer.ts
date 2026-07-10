import type { TopScorer } from '../types';

/** Map API top-scorer / similar rows into PlayerHeadImg player props. */
export function toHeadPlayer(scorer: Pick<
  TopScorer,
  'memberId' | 'head_photo' | 'isCaptain' | 'isTeamOwner' | 'squadRole' | 'position'
>) {
  return {
    memberId: scorer.memberId,
    head_photo: scorer.head_photo,
    isCaptain: scorer.isCaptain,
    isTeamOwner: scorer.isTeamOwner,
    squadRole: scorer.squadRole,
    position: scorer.position || '',
  };
}
