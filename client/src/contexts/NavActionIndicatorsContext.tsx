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
import { adminAPI, registrationAPI, teamsAPI } from '../api/client';
import { useAuth } from './AuthContext';
import {
    countAdminActionsInWorkflowData,
    type WorkflowQueueSnapshot,
} from '../utils/adminWorkflowPendingCount';
import {
    computeProfileActionRequired,
    getOwnerPendingJoinCount,
    hasAdminActionRequired,
    resolveLegacyCaptainTeam,
    shouldFetchLegacyCaptainPending,
} from '../utils/navActionIndicators';
import { canAccessAdminPanel } from '../utils/tournamentUser';

const FOCUS_DEBOUNCE_MS = 2000;
const PROFILE_POLL_MS = 60_000;

interface RefreshIndicatorsOptions {
    /** Skip admin pending-count fetch (e.g. post-mutation on workflow page). */
    light?: boolean;
    /** When fetching admin count, cross-check queues if endpoint returns 0. Default true on full refresh. */
    adminReconcile?: boolean;
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

async function fetchAdminPendingCount(reconcile: boolean): Promise<number> {
    try {
        const res = await adminAPI.getWorkflowPendingCount();
        const data = res.data as { total?: number; partial?: boolean };
        const fromEndpoint = data.total ?? 0;
        if (!reconcile || (fromEndpoint > 0 && !data.partial)) return fromEndpoint;
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

export function NavActionIndicatorsProvider({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const [adminPendingCount, setAdminPendingCount] = useState<number | null>(null);
    const [legacyCaptainPendingCount, setLegacyCaptainPendingCount] = useState(0);
    const [ownerPendingJoinCount, setOwnerPendingJoinCount] = useState(0);
    const lastFocusRefreshRef = useRef(0);
    const lastAdminCountRef = useRef<number | null>(null);

    const fetchAdminCount = useCallback(async (reconcile = false) => {
        if (!canAccessAdminPanel(user)) {
            setAdminPendingCount(null);
            lastAdminCountRef.current = null;
            return;
        }
        try {
            const count = await fetchAdminPendingCount(reconcile);
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
            setOwnerPendingJoinCount(Math.max(fromAuth, fetched));
        } catch {
            setOwnerPendingJoinCount((prev) => Math.max(prev, fromAuth));
        }
    }, [user]);

    const refreshIndicators = useCallback(
        async (options?: RefreshIndicatorsOptions) => {
            const tasks: Promise<void>[] = [
                fetchLegacyCaptainCount(),
                fetchOwnerCount(),
            ];
            if (canAccessAdminPanel(user)) {
                if (!options?.light) {
                    tasks.push(fetchAdminCount(options?.adminReconcile ?? true));
                }
            } else {
                setAdminPendingCount(null);
            }
            await Promise.all(tasks);
        },
        [user, fetchAdminCount, fetchLegacyCaptainCount, fetchOwnerCount]
    );

    useEffect(() => {
        if (!user) {
            setOwnerPendingJoinCount(0);
            return;
        }
        setOwnerPendingJoinCount(getOwnerPendingJoinCount(user));
    }, [
        user,
        user?.tournamentRegistration?.boys?.ownerPendingJoinCount,
        user?.tournamentRegistration?.girls?.ownerPendingJoinCount,
    ]);

    useEffect(() => {
        if (loading) return;
        void refreshIndicators();
        const onFocus = () => {
            const now = Date.now();
            if (now - lastFocusRefreshRef.current < FOCUS_DEBOUNCE_MS) return;
            lastFocusRefreshRef.current = now;
            // Single refresh: profile counts + endpoint-only admin (no queue fanout on focus).
            void refreshIndicators({ adminReconcile: false });
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [
        loading,
        user?.id,
        user?.role,
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
        return computeProfileActionRequired(user, {
            legacyCaptainPendingCount,
            ownerPendingJoinCount,
        });
    }, [user, legacyCaptainPendingCount, ownerPendingJoinCount]);

    const adminActionRequired = useMemo(() => {
        if (!canAccessAdminPanel(user)) return false;
        return hasAdminActionRequired(adminPendingCount);
    }, [user, adminPendingCount]);

    const value = useMemo(
        () => ({
            profileActionRequired,
            adminActionRequired,
            refreshIndicators,
            refreshAdminCount: () => fetchAdminCount(false),
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

