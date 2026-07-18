import type { CSSProperties } from 'react';
import type { Player } from '../../types';
import { getNextPlayerHeadFallback, type HeadFallbackStage } from '../../utils/playerHeadImgError';
import { resolvePlayerHeadUrl } from '../../utils/playerHeadUrl';

type HeadPlayer = Pick<
  Player,
  'memberId' | 'head_photo' | 'isTeamOwner' | 'isCaptain' | 'squadRole' | 'position'
>;

type SharePlayerHeadProps = {
  player: HeadPlayer;
  alt?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Share-only head image: falls back by mutating `img.src` in place so
 * `waitForImages` can observe the final URL without waiting on React setState.
 */
export function SharePlayerHead({ player, alt = '', className, style }: SharePlayerHeadProps) {
  return (
    <img
      src={resolvePlayerHeadUrl(player)}
      alt={alt}
      className={className}
      style={style}
      data-head-stage=""
      onError={(event) => {
        const image = event.currentTarget;
        const stage = (image.dataset.headStage || '') as HeadFallbackStage;
        const next = getNextPlayerHeadFallback(image.currentSrc || image.src, stage, player);
        if (!next) return;
        image.dataset.headStage = next.stage;
        image.src = next.src;
      }}
    />
  );
}
