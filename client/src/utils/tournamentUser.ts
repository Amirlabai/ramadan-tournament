import type { TournamentRegistrationSummary, User } from '../contexts/AuthContext';

export type RegistrationDivisionSlug = 'boys' | 'girls';

/** Platform role from DB — not tournament captain/player. Set on every `/auth/me` response. */
export function isPlatformAdmin(user: User | null | undefined): boolean {
    return (
        user?.isPlatformAdmin === true ||
        user?.role === 'admin' ||
        user?.role === 'Admin'
    );
}

/** Legacy captain: approved mapping with teamId and memberId 0 (pre-PRD workflow). */
export function isLegacyMappedCaptain(user: User | null | undefined): boolean {
    const mapped = user?.mappedPlayerInfo;
    return (
        mapped?.status === 'approved' &&
        !!mapped.teamId &&
        mapped.teamId > 0 &&
        mapped.memberId === 0
    );
}

/** Legacy player: approved mapping with a roster memberId. */
export function isLegacyMappedPlayer(user: User | null | undefined): boolean {
    const mapped = user?.mappedPlayerInfo;
    return mapped?.status === 'approved' && !!mapped.teamId && mapped.memberId > 0;
}

/** Show legacy CaptainTeamRequests panel (pre-PRD captains without ownedTeamId). */
export function showLegacyCaptainPanel(
    user: User | null | undefined,
    usesPrdRegistration: boolean
): boolean {
    if (usesPrdRegistration || !user) return false;
    return ownsTeam(user) || isLegacyMappedCaptain(user);
}

export function getDivisionReg(
    user: User | null | undefined,
    slug: RegistrationDivisionSlug
): TournamentRegistrationSummary | null | undefined {
    return user?.tournamentRegistration?.[slug];
}

export function isOnRoster(user: User | null | undefined, slug?: RegistrationDivisionSlug): boolean {
    if (!user?.tournamentRegistration) return false;
    if (slug) {
        return !!getDivisionReg(user, slug)?.onRoster;
    }
    return !!(
        user.tournamentRegistration.boys?.onRoster || user.tournamentRegistration.girls?.onRoster
    );
}

export function ownsTeam(user: User | null | undefined, slug?: RegistrationDivisionSlug): boolean {
    if (!user?.tournamentRegistration) return false;
    if (slug) {
        return !!getDivisionReg(user, slug)?.ownedTeamId;
    }
    return !!(
        user.tournamentRegistration.boys?.ownedTeamId ||
        user.tournamentRegistration.girls?.ownedTeamId
    );
}

/** PRD captain team ids from tournament registration (not legacy mapped captains). */
export function getOwnedTeamIds(user: User | null | undefined): number[] {
    if (!user?.tournamentRegistration) return [];
    const ids: number[] = [];
    const boys = user.tournamentRegistration.boys?.ownedTeamId;
    const girls = user.tournamentRegistration.girls?.ownedTeamId;
    if (boys) ids.push(boys);
    if (girls) ids.push(girls);
    return ids;
}

/** Admin roster mutations (add/delete players, photos). Captains approve joins on Profile/Teams only. */
export function canManageTeamRoster(_user: User | null | undefined, _teamId: number): boolean {
    return isPlatformAdmin(_user);
}

/** Platform admins only. PRD captains manage join requests on Profile and the Teams page. */
export function canAccessAdminPanel(user: User | null | undefined): boolean {
    return isPlatformAdmin(user);
}

export type TournamentParticipationBadge = 'captain' | 'player' | null;

/** Tournament participation label for Profile badge (separate from platform admin). */
export function getTournamentParticipationBadge(
    user: User | null | undefined
): TournamentParticipationBadge {
    const boys = user?.tournamentRegistration?.boys;
    const girls = user?.tournamentRegistration?.girls;
    if (boys?.ownedTeamId || girls?.ownedTeamId) return 'captain';
    if (boys?.onRoster || girls?.onRoster) return 'player';

    if (isLegacyMappedCaptain(user)) return 'captain';
    if (isLegacyMappedPlayer(user)) return 'player';
    return null;
}
