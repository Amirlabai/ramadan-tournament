import type { Player } from '../types';
import { resolveAssetUrl } from './assetUrl';

/** Primary position label before legacy slash combos (e.g. `שוער/ שחקן`). */
function primaryPosition(position?: string): string {
    return position?.split('/')[0]?.trim() ?? '';
}

function isGoalkeeper(player: Pick<Player, 'squadRole' | 'position'>): boolean {
    return player.squadRole === 'goalkeeper' || primaryPosition(player.position) === 'שוער';
}

function headAsset(filename: string): string {
    const resolved = resolveAssetUrl(`assets/images/players/heads/${filename}`);
    // Relative fallback when origin is unavailable (SSR); client static assets only.
    return resolved ?? `/assets/images/players/heads/${filename}`;
}

export function defaultPlayerHeadUrl(): string {
    return headAsset('default.jpg');
}

export function resolvePlayerHeadUrl(
    player: Pick<Player, 'head_photo' | 'isTeamOwner' | 'isCaptain' | 'squadRole' | 'position'>,
): string {
    const uploaded = resolveAssetUrl(player.head_photo);
    if (uploaded) return uploaded;
    if (player.isTeamOwner) return headAsset('manager.jpg');
    if (player.isCaptain) return headAsset('captain.jpg');
    if (isGoalkeeper(player)) return headAsset('gk.jpg');
    if (primaryPosition(player.position) === 'מחמם ספסל') {
        return headAsset('bench.jpg');
    }
    return defaultPlayerHeadUrl();
}
