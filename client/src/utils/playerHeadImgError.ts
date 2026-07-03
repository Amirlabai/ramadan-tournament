import type { Player } from '../types';
import { defaultPlayerHeadUrl, resolvePlayerHeadUrl } from './playerHeadUrl';

export type HeadFallbackStage = '' | 'role' | 'default';

/** Named role defaults only — excludes legacy seed paths like `heads/100.jpg`. */
const ROLE_HEAD_PATTERN = /\/players\/heads\/(?:default|bench|gk|captain|manager)\.jpg/i;

export function isRoleDefaultHeadUrl(src: string): boolean {
    return ROLE_HEAD_PATTERN.test(src);
}

export function isDefaultHeadUrl(src: string): boolean {
    return src.includes('/players/heads/default.jpg');
}

export function getNextPlayerHeadFallback(
    currentSrc: string,
    stage: HeadFallbackStage,
    player: Pick<Player, 'head_photo' | 'isTeamOwner' | 'isCaptain' | 'squadRole' | 'position'>,
): { src: string; stage: HeadFallbackStage } | null {
    if (isDefaultHeadUrl(currentSrc)) return null;
    if (!isRoleDefaultHeadUrl(currentSrc) && stage !== 'role') {
        return { src: resolvePlayerHeadUrl({ ...player, head_photo: '' }), stage: 'role' };
    }
    return { src: defaultPlayerHeadUrl(), stage: 'default' };
}
