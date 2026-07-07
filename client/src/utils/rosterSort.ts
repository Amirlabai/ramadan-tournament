import type { Player } from '../types';

function primaryPosition(position?: string): string {
    return position?.split('/')[0]?.trim() ?? '';
}

function isGoalkeeper(player: Pick<Player, 'squadRole' | 'position'>): boolean {
    return player.squadRole === 'goalkeeper' || primaryPosition(player.position) === 'שוער';
}

function isBenchWarmer(player: Pick<Player, 'position'>): boolean {
    return primaryPosition(player.position) === 'מחמם ספסל';
}

/** Lower tier = earlier in roster display. Bench players are last among unassigned. */
function rosterTier(player: Player): number {
    if (player.isTeamOwner) return 0;
    if (player.isCaptain) return 1;
    if (isGoalkeeper(player)) return 2;
    if (player.squadRole === 'defense') return 3;
    if (player.squadRole === 'attack') return 4;
    // Other squad roles (e.g. captain flag missing but squadRole set)
    if (player.squadRole) return 5;
    return 6;
}

const UNASSIGNED_TIER = 6;

export function compareRosterPlayers(a: Player, b: Player): number {
    const tierA = rosterTier(a);
    const tierB = rosterTier(b);
    if (tierA !== tierB) return tierA - tierB;

    if (tierA === UNASSIGNED_TIER) {
        const benchWarmDiff = Number(isBenchWarmer(a)) - Number(isBenchWarmer(b));
        if (benchWarmDiff !== 0) return benchWarmDiff;
    }

    return (a.number ?? 99) - (b.number ?? 99);
}

export function sortRosterPlayers(players: Player[]): Player[] {
    return [...players].sort(compareRosterPlayers);
}
