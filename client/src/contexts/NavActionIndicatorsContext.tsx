import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { adminAPI, registrationAPI, teamsAPI, usersAPI } from '../api/client';
import { useAuth } from './AuthContext';
import type { TournamentRegistrationSummary } from './AuthContext';
import {
    countAdminActionsInWorkflowData,
    type WorkflowQueueSnapshot,
} from '../utils/adminWorkflowPendingCount';
import {
    computeProfileActionRequired,
    getOwnerPendingJoinCount,
    hasAdminActionRequired,
    hasRegistrationTask,
    resolveLegacyCaptainTeam,
    shouldFetchLegacyCaptainPending,
} from '../utils/navActionIndicators';
import { canAccessAdminPanel } from '../utils/tournamentUser';

const FOCUS_DEBOUNCE_MS = 2000;
const PROFILE_POLL_MS = 60_000;

interface RefreshIndicatorsOptions {
    /** Skip admin pending-count fetch (e.g. post-mutation on workflow page). */
    light?: boolean;
}

interface NavActionIndicatorsContextValue {
    profileActionRequired: boolean;
    adminActionRequired: boolean;
    refreshIndicators: (options?: RefreshIndicatorsOptions) => Promise<void>;
    refreshAdminCount: () => Promise<void>;
}

const NavActionIndicatorsContext = createContext<NavActionIndicatorsContextValue | undefined>(
    undefined
);

async function fetchOwnerPendingJoinCount(user: NonNullable<ReturnType<typeof useAuth>['user']>) {
    const teams: { teamId: number; slug: 'boys' | 'girls' }[] = [];
    const boysOwned = user.tournamentRegistration?.boys?.ownedTeamId;
    const girlsOwned = user.tournamentRegistration?.girls?.ownedTeamId;
    if (boysOwned) teams.push({ teamId: boysOwned, slug: 'boys' });
    if (girlsOwned) teams.push({ teamId: girlsOwned, slug: 'girls' });
    if (!teams.length) return 0;

    const results = await Promise.allSettled(
        teams.map((t) => registrationAPI.listOwnerJoinRequests(t.teamId, t.slug))
    );
    return results.reduce((sum, result) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value.data)) {
            return sum + result.value.data.length;
        }
        return sum;
    }, 0);
}

async function fetchAdminPendingCountFromQueues(): Promise<number> {
    const seasonsRes = await adminAPI.listSeasons();
    const seasons = (seasonsRes.data ?? []) as Array<{ id: string; isActive?: boolean }>;
    const activeSeasons = seasons.filter((s) => s.isActive === true);

    let legacyCount = 0;
    try {
        const legacyRes = await adminAPI.getTeamRequests();
        legacyCount = Array.isArray(legacyRes.data) ? legacyRes.data.length : 0;
    } catch {
        // Omit legacy from fallback when request fails.
    }

    if (activeSeasons.length === 0) return legacyCount;

    const queueResults = await Promise.all(
        activeSeasons.map((s) =>
            adminAPI.getWorkflowQueues(s.id).catch(() => ({ data: null }))
        )
    );
    const workflowTotal = queueResults.reduce((sum, res) => {
        if (!res.data) return sum;
        return sum + countAdminActionsInWorkflowData(res.data as WorkflowQueueSnapshot);
    }, 0);
    return workflowTotal + legacyCount;
}

/** Endpoint-only; trust `0`. Use after mutations and on window focus. */
type AdminCountMode = 'quick' | 'reconcile';

async function fetchAdminPendingCount(mode: AdminCountMode): Promise<number> {
    try {
        const res = await adminAPI.getWorkflowPendingCount();
        const fromEndpoint = (res.data as { total?: number }).total ?? 0;
        if (fromEndpoint > 0 || mode === 'quick') return fromEndpoint;
        try {
            const fromQueues = await fetchAdminPendingCountFromQueues();
            return Math.max(fromEndpoint, fromQueues);
        } catch {
            return fromEndpoint;
        }
    } catch {
        try {
            return await fetchAdminPendingCountFromQueues();
        } catch {
            return 0;
        }
    }
}

async function fetchRegistrationTaskFlags() {
    const [boysRes, girlsRes] = await Promise.all([
        usersAPI.getRegistration('boys').catch(() => null),
        usersAPI.getRegistration('girls').catch(() => null),
    ]);
    const boys = boysRes?.data as TournamentRegistrationSummary | undefined;
    const girls = girlsRes?.data as TournamentRegistrationSummary | undefined;
    return {
        boys: hasRegistrationTask(boys ?? null),
        girls: hasRegistrationTask(girls ?? null),
    };
}

export function NavActionIndicatorsProvider({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const [adminPendingCount, setAdminPendingCount] = useState<number | null>(null);
    const [legacyCaptainPendingCount, setLegacyCaptainPendingCount] = useState(0);
    const [ownerPendingJoinCount, setOwnerPendingJoinCount] = useState(0);
    const [registrationTaskBoys, setRegistrationTaskBoys] = useState(false);
    const [registrationTaskGirls, setRegistrationTaskGirls] = useState(false);
    const lastFocusRefreshRef = useRef(0);
    const lastAdminCountRef = useRef<number | null>(null);

    const fetchAdminCount = useCallback(async (mode: AdminCountMode = 'reconcile') => {
        if (!canAccessAdminPanel(user)) {
            setAdminPendingCount(null);
            lastAdminCountRef.current = null;
            return;
        }
        try {
            const count = await fetchAdminPendingCount(mode);
            lastAdminCountRef.current = count;
            setAdminPendingCount(count);
        } catch {
            if (lastAdminCountRef.current !== null) {
                setAdminPendingCount(lastAdminCountRef.current);
            } else {
                setAdminPendingCount(0);
            }
        }
    }, [user]);

    const fetchLegacyCaptainCount = useCallback(async () => {
        if (!shouldFetchLegacyCaptainPending(user)) {
            setLegacyCaptainPendingCount(0);
            return;
        }
        const team = resolveLegacyCaptainTeam(user);
        if (!team) {
            setLegacyCaptainPendingCount(0);
            return;
        }
        try {
            const res = await teamsAPI.getRequests(team.teamId, team.slug);
            const list = Array.isArray(res.data) ? res.data : [];
            setLegacyCaptainPendingCount(list.length);
        } catch {
            // Keep last count on transient failures.
        }
    }, [user]);

    const fetchOwnerCount = useCallback(async () => {
        if (!user) {
            setOwnerPendingJoinCount(0);
            return;
        }
        const fromAuth = getOwnerPendingJoinCount(user);
        try {
            const fetched = await fetchOwnerPendingJoinCount(user);
            setOwnerPendingJoinCount((prev) =>
                Math.max(prev, fromAuth, fetched)
            );
        } catch {
            setOwnerPendingJoinCount((prev) => Math.max(prev, fromAuth));
        }
    }, [user]);

    const fetchRegistrationTasks = useCallback(async () => {
        if (!user) {
            setRegistrationTaskBoys(false);
            setRegistrationTaskGirls(false);
            return;
        }
        const boysFromAuth = hasRegistrationTask(user.tournamentRegistration?.boys ?? null);
        const girlsFromAuth = hasRegistrationTask(user.tournamentRegistration?.girls ?? null);
        const tr = user.tournamentRegistration;
        const needsBoysApi = !boysFromAuth && (tr === undefined || tr.boys != null);
        const needsGirlsApi = !girlsFromAuth && (tr === undefined || tr.girls != null);
        if (!needsBoysApi && !needsGirlsApi) {
            setRegistrationTaskBoys(boysFromAuth);
            setRegistrationTaskGirls(girlsFromAuth);
            return;
        }
        try {
            const flags = await fetchRegistrationTaskFlags();
            setRegistrationTaskBoys((prev) =>
                boysFromAuth || (needsBoysApi ? flags.boys : prev)
            );
            setRegistrationTaskGirls((prev) =>
                girlsFromAuth || (needsGirlsApi ? flags.girls : prev)
            );
        } catch {
            setRegistrationTaskBoys(boysFromAuth);
            setRegistrationTaskGirls(girlsFromAuth);
        }
    }, [user]);

    const refreshIndicators = useCallback(
        async (options?: RefreshIndicatorsOptions) => {
            const tasks: Promise<void>[] = [
                fetchLegacyCaptainCount(),
                fetchOwnerCount(),
                fetchRegistrationTasks(),
            ];
            if (canAccessAdminPanel(user)) {
                if (!options?.light) {
                    tasks.push(fetchAdminCount('reconcile'));
                }
            } else {
                setAdminPendingCount(null);
            }
            await Promise.all(tasks);
        },
        [user, fetchAdminCount, fetchLegacyCaptainCount, fetchOwnerCount, fetchRegistrationTasks]
    );

    useEffect(() => {
        if (loading) return;
        void refreshIndicators();
        const onFocus = () => {
            const now = Date.now();
            if (now - lastFocusRefreshRef.current < FOCUS_DEBOUNCE_MS) return;
            lastFocusRefreshRef.current = now;
            void refreshIndicators({ light: true });
            if (canAccessAdminPanel(user)) {
                void fetchAdminCount('quick');
            }
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [
        loading,
        user?.id,
        user?.tournamentRegistration?.boys?.ownedTeamId,
        user?.tournamentRegistration?.girls?.ownedTeamId,
        user?.tournamentRegistration?.boys?.ownerPendingJoinCount,
        user?.tournamentRegistration?.girls?.ownerPendingJoinCount,
        user?.tournamentRegistration?.boys?.status,
        user?.tournamentRegistration?.girls?.status,
        refreshIndicators,
        fetchAdminCount,
    ]);

    useEffect(() => {
        if (loading || !user) return;
        const ownsTeam = !!(
            user.tournamentRegistration?.boys?.ownedTeamId ||
            user.tournamentRegistration?.girls?.ownedTeamId
        );
        const legacyCaptain = shouldFetchLegacyCaptainPending(user);
        if (!ownsTeam && !legacyCaptain) return;
        const intervalId = window.setInterval(() => {
            if (ownsTeam) void fetchOwnerCount();
            if (legacyCaptain) void fetchLegacyCaptainCount();
        }, PROFILE_POLL_MS);
        return () => window.clearInterval(intervalId);
    }, [loading, user, fetchOwnerCount, fetchLegacyCaptainCount]);

    const profileActionRequired = useMemo(() => {
        if (!user) return false;
        const ownerFromAuth = getOwnerPendingJoinCount(user);
        const boysFromAuth = hasRegistrationTask(user.tournamentRegistration?.boys ?? null);
        const girlsFromAuth = hasRegistrationTask(user.tournamentRegistration?.girls ?? null);
        if (ownerFromAuth > 0 || boysFromAuth || girlsFromAuth) return true;
        return computeProfileActionRequired(user, {
            legacyCaptainPendingCount,
            ownerPendingJoinCount,
            registrationTaskBoys,
            registrationTaskGirls,
        });
    }, [
        user,
        legacyCaptainPendingCount,
        ownerPendingJoinCount,
        registrationTaskBoys,
        registrationTaskGirls,
    ]);

    const adminActionRequired = useMemo(() => {
        if (!canAccessAdminPanel(user)) return false;
        return hasAdminActionRequired(adminPendingCount);
    }, [user, adminPendingCount]);

    const value = useMemo(
        () => ({
            profileActionRequired,
            adminActionRequired,
            refreshIndicators,
            refreshAdminCount: () => fetchAdminCount('quick'),
        }),
        [profileActionRequired, adminActionRequired, refreshIndicators, fetchAdminCount]
    );

    return (
        <NavActionIndicatorsContext.Provider value={value}>
            {children}
        </NavActionIndicatorsContext.Provider>
    );
}

export function useNavActionIndicators(): NavActionIndicatorsContextValue {
    const context = useContext(NavActionIndicatorsContext);
    if (context === undefined) {
        throw new Error('useNavActionIndicators must be used within NavActionIndicatorsProvider');
    }
    return context;
}

