import type { TournamentRegistrationSummary, User } from '../contexts/AuthContext';
import { showLegacyCaptainPanel } from './tournamentUser';

export function usesPrdRegistration(user: User | null | undefined): boolean {
    const tr = user?.tournamentRegistration;
    if (!tr) return false;
    return !!(
        tr.boys?.ownedTeamId ||
        tr.girls?.ownedTeamId ||
        (tr.boys?.status && tr.boys.status !== 'none') ||
        (tr.girls?.status && tr.girls.status !== 'none')
    );
}

export function resolveLegacyCaptainTeam(user: User | null | undefined): {
    teamId: number;
    slug: 'boys' | 'girls';
    teamName: string;
} | null {
    if (!user) return null;

    const boys = user.tournamentRegistration?.boys;
    const girls = user.tournamentRegistration?.girls;
    if (boys?.ownedTeamId) {
        return { teamId: boys.ownedTeamId, slug: 'boys', teamName: `קבוצה #${boys.ownedTeamId}` };
    }
    if (boys?.onRoster?.isCaptain) {
        return {
            teamId: boys.onRoster.teamId,
            slug: 'boys',
            teamName: `קבוצה #${boys.onRoster.teamId}`,
        };
    }
    if (girls?.ownedTeamId) {
        return { teamId: girls.ownedTeamId, slug: 'girls', teamName: `קבוצה #${girls.ownedTeamId}` };
    }
    if (girls?.onRoster?.isCaptain) {
        return {
            teamId: girls.onRoster.teamId,
            slug: 'girls',
            teamName: `קבוצה #${girls.onRoster.teamId}`,
        };
    }

    const mapped = user.mappedPlayerInfo;
    if (mapped?.teamId) {
        const teamName =
            (mapped as { teamName?: string }).teamName || `קבוצה #${mapped.teamId}`;
        return { teamId: mapped.teamId, slug: 'boys', teamName };
    }
    return null;
}

export function shouldFetchLegacyCaptainPending(user: User | null | undefined): boolean {
    return showLegacyCaptainPanel(user, usesPrdRegistration(user));
}

export function hasRegistrationTask(
    reg: TournamentRegistrationSummary | null | undefined
): boolean {
    if (!reg) return false;

    if (reg.invoiceAlert) return true;
    if (reg.awaitingAdminIdentity) return true;

    if (reg.pendingJoin || reg.pendingCreation || reg.pendingTransfer) return false;

    if (reg.status === 'active' && reg.onRoster) return false;

    if (reg.status === 'none') return false;

    if (reg.status !== 'active') return true;

    return false;
}

export function getOwnerPendingJoinCount(user: User): number {
    const boys = user.tournamentRegistration?.boys?.ownerPendingJoinCount ?? 0;
    const girls = user.tournamentRegistration?.girls?.ownerPendingJoinCount ?? 0;
    return boys + girls;
}

export function computeProfileActionRequired(
    user: User | null | undefined,
    options: {
        legacyCaptainPendingCount: number;
        ownerPendingJoinCount: number;
        registrationTaskBoys?: boolean;
        registrationTaskGirls?: boolean;
    }
): boolean {
    const ownerFromAuth = user ? getOwnerPendingJoinCount(user) : 0;
    if (Math.max(options.ownerPendingJoinCount, ownerFromAuth) > 0) return true;
    if (options.legacyCaptainPendingCount > 0) return true;
    if (options.registrationTaskBoys) return true;
    if (options.registrationTaskGirls) return true;
    if (hasRegistrationTask(user?.tournamentRegistration?.boys)) return true;
    if (hasRegistrationTask(user?.tournamentRegistration?.girls)) return true;

    return false;
}

export function hasAdminActionRequired(count: number | null): boolean {
    return count !== null && count > 0;
}
