import type { Player, TopScorer } from '../types';

type HeadPlayer = Pick<
  Player,
  'memberId' | 'head_photo' | 'isTeamOwner' | 'isCaptain' | 'squadRole' | 'position'
>;

/** Map API top-scorer / similar rows into PlayerHeadImg player props. */
export function toHeadPlayer(
  scorer: Pick<
    TopScorer,
    'memberId' | 'head_photo' | 'isCaptain' | 'isTeamOwner' | 'squadRole' | 'position'
  >,
): HeadPlayer {
  return {
    memberId: scorer.memberId,
    head_photo: scorer.head_photo,
    isCaptain: scorer.isCaptain ?? false,
    isTeamOwner: scorer.isTeamOwner,
    squadRole: scorer.squadRole,
    position: scorer.position || '',
  };
}
