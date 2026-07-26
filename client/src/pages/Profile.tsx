import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, type User } from '../contexts/AuthContext';
import { usersAPI, teamsAPI, statsAPI, statsGirlsAPI, registrationAPI } from '../api/client';
import type { Standing, TopScorer } from '../types';
import CaptainTeamRequests from '../components/admin/CaptainTeamRequests';
import TeamRegistrationActions from '../components/registration/TeamRegistrationActions';
import TeamOwnerSettings from '../components/registration/TeamOwnerSettings';
import TournamentRegistrationCard from '../components/profile/TournamentRegistrationCard';
import SEO from '../components/SEO';
import { ProfileSkeleton } from '../components/skeleton';
import PageLoading from '../components/PageLoading';
import { useMinSkeletonTime } from '../hooks/useMinSkeletonTime';
import TournamentRoleStar from '../components/TournamentRoleStar';
import {
    getProfileTournamentBadge,
    isOnRoster,
    isPlatformAdmin,
    needsIdentitySubmission,
    showLegacyCaptainPanel,
} from '../utils/tournamentUser';
import { useHasClaimablePlayers } from '../hooks/useHasClaimablePlayers';
import { TEAM_DESC_MAX_LEN, TEAM_NAME_MAX_LEN, displayOrDash } from '@ramadan-tournament/shared';
import { tournamentPaths } from '../utils/tournamentPaths';
import { resolveAssetUrl } from '../utils/assetUrl';
import { SHOW_PROFILE_TEAM_CREATION } from '../config/registrationUi';
import './Profile.css';

const PROFILE_ROLE_LABELS: Record<string, string> = {
    Admin: 'מנהל',
    Captain: 'קפטן',
    Player: 'שחקן',
    User: 'משתמש',
    admin: 'מנהל',
};

function resolveRegistrationSlug(user: User | null | undefined): 'boys' | 'girls' {
    if (user?.activeDivision === 'girls') return 'girls';
    if (user?.activeDivision === 'boys') return 'boys';
    if (user?.tournamentRegistration?.girls?.status === 'active') return 'girls';
    if (user?.tournamentRegistration?.boys?.status === 'active') return 'boys';
    return 'boys';
}

function ownedTeamIdForReg(
    reg?: { ownedTeamId?: number | null } | null
): number | null {
    return reg?.ownedTeamId ?? null;
}

function claimedCaptainTeamIdForReg(
    reg?: { onRoster?: { teamId: number; isCaptain?: boolean } | null } | null
): number | null {
    const roster = reg?.onRoster;
    if (roster?.isCaptain === true && roster.teamId > 0) return roster.teamId;
    return null;
}

/** Owner or claimed captain — branding + join panels on Profile. */
function pickManageableTeamContext(user: User): { slug: 'boys' | 'girls'; teamId: number | null } {
    const active = resolveRegistrationSlug(user);
    const boys = user.tournamentRegistration?.boys;
    const girls = user.tournamentRegistration?.girls;

    const activeOwned = ownedTeamIdForReg(active === 'girls' ? girls : boys);
    if (activeOwned) return { slug: active, teamId: activeOwned };

    const boysOwned = ownedTeamIdForReg(boys);
    if (boysOwned) return { slug: 'boys', teamId: boysOwned };

    const girlsOwned = ownedTeamIdForReg(girls);
    if (girlsOwned) return { slug: 'girls', teamId: girlsOwned };

    const activeCaptain = claimedCaptainTeamIdForReg(active === 'girls' ? girls : boys);
    if (activeCaptain) return { slug: active, teamId: activeCaptain };

    const boysCaptain = claimedCaptainTeamIdForReg(boys);
    if (boysCaptain) return { slug: 'boys', teamId: boysCaptain };

    const girlsCaptain = claimedCaptainTeamIdForReg(girls);
    if (girlsCaptain) return { slug: 'girls', teamId: girlsCaptain };

    return { slug: active, teamId: null };
}

const Profile = () => {
    const { user, loading, logout, refreshUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const navFocusIdentity = (location.state as { focusIdentity?: 'boys' | 'girls' } | null)?.focusIdentity;
    const registrationSlug = user ? resolveRegistrationSlug(user) : 'boys';
    const claimCheckSlug = navFocusIdentity ?? registrationSlug;
    const { hasClaimablePlayers } = useHasClaimablePlayers(claimCheckSlug);

    const [avatarLoading, setAvatarLoading] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [teamDesc, setTeamDesc] = useState('');
    const [teamRequestMsg, setTeamRequestMsg] = useState('');

    // Player profile editing
    const playerProfile = user?.playerProfile ?? null;
    const manageableCtx = user
        ? pickManageableTeamContext(user)
        : { slug: 'boys' as const, teamId: null };
    const manageableSlug = manageableCtx.slug;
    const manageableTeamId = manageableCtx.teamId;
    const divisionReg = user?.tournamentRegistration?.[registrationSlug];
    const onRoster = divisionReg?.onRoster ?? null;
    const ownsTeam = divisionReg?.ownedTeamId ?? null;
    const canLeaveActiveRoster = !!onRoster && !ownsTeam && !onRoster?.isCaptain;
    const pendingJoin = divisionReg?.pendingJoin ?? null;
    const canEditPlayer = !!(playerProfile || onRoster || pendingJoin);
    const [editingPlayer, setEditingPlayer] = useState(false);
    const [playerForm, setPlayerForm] = useState({ firstName: '', lastName: '', nickname: '', number: '', position: '', bio: '' });
    const [playerSaving, setPlayerSaving] = useState(false);
    const [playerMsg, setPlayerMsg] = useState('');

    const [manageableTeamName, setManageableTeamName] = useState('');

    // Stats data
    const [teamStanding, setTeamStanding] = useState<Standing | null>(null);
    const [playerGoals, setPlayerGoals] = useState<number | null>(null);
    const [rosterTeamName, setRosterTeamName] = useState<string | null>(null);
    const [identityFocusHint, setIdentityFocusHint] = useState<string | null>(null);

    const startEditPlayer = () => {
        setPlayerForm({
            firstName: playerProfile?.firstName ?? '',
            lastName: playerProfile?.lastName ?? '',
            nickname: playerProfile?.nickname ?? '',
            number: playerProfile?.number?.toString() ?? '',
            position: playerProfile?.position ?? '',
            bio: playerProfile?.bio ?? ''
        });
        setPlayerMsg('');
        setEditingPlayer(true);
    };

    const handleSavePlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        setPlayerSaving(true);
        setPlayerMsg('');
        try {
            if (!playerForm.firstName.trim() || !playerForm.lastName.trim()) {
                setPlayerMsg('שם פרטי ושם משפחה הם שדות חובה');
                setPlayerSaving(false);
                return;
            }
            const number = playerForm.number.trim() ? Number(playerForm.number) : undefined;
            const lastName = playerForm.lastName.trim();
            await usersAPI.updatePlayerProfile({
                ...playerForm,
                firstName: playerForm.firstName.trim(),
                lastName,
                nickname: playerForm.nickname.trim(),
                number,
            });
            await refreshUser();
            setEditingPlayer(false);
            setPlayerMsg('הפרטים עודכנו בהצלחה');
        } catch (err: any) {
            setPlayerMsg(err.response?.data?.error || 'שגיאה בשמירה');
        } finally {
            setPlayerSaving(false);
        }
    };

    useEffect(() => {
        if (!manageableTeamId) {
            setManageableTeamName('');
            return;
        }
        teamsAPI
            .getById(manageableTeamId, manageableSlug)
            .then((res) => setManageableTeamName((res.data as { name: string }).name))
            .catch(() => setManageableTeamName(''));
    }, [manageableTeamId, manageableSlug]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        const focusSlug = (location.state as { focusIdentity?: 'boys' | 'girls' } | null)?.focusIdentity;
        if (!focusSlug || loading || !user) return;

        let cancelled = false;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const scrollBehavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';

        const clearFocusState = () => {
            navigate('.', { replace: true, state: {} });
        };

        const tryFocusIdentity = (attempt = 0) => {
            if (cancelled) return;

            const card = document.getElementById(`registration-card-${focusSlug}`);
            const input = document.getElementById(`personal-id-${focusSlug}`) as HTMLInputElement | null;
            const cardLoading = card?.querySelector('.spinner-border');

            if (input && card && !cardLoading) {
                card.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
                input.focus({ preventScroll: true });
                setIdentityFocusHint(null);
                clearFocusState();
                return;
            }

            if (card && !cardLoading && !input) {
                setIdentityFocusHint(
                    'לא נמצא טופס זהות לעונה זו. וודא שבחרת את הטורניר הנכון או שהרישום כבר פעיל.'
                );
                clearFocusState();
                return;
            }

            if (attempt < 20) {
                window.setTimeout(() => tryFocusIdentity(attempt + 1), 100);
                return;
            }

            setIdentityFocusHint(
                'לא ניתן לגלול לטופס הזהות. השלם את פרטי תעודת הזהות ושנת הלידה בכרטיס הרישום למעלה.'
            );
            clearFocusState();
        };

        tryFocusIdentity();

        return () => {
            cancelled = true;
        };
    }, [location.state, loading, user, navigate]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!user) return;
            const slug = resolveRegistrationSlug(user);
            const roster = user.tournamentRegistration?.[slug]?.onRoster;
            if (!roster) {
                setTeamStanding(null);
                setPlayerGoals(null);
                setRosterTeamName(null);
                return;
            }

            try {
                const teamRes = await teamsAPI.getById(roster.teamId, slug);
                setRosterTeamName((teamRes.data as { name?: string }).name ?? null);

                if (slug === 'girls') {
                    const standingsRes = await statsGirlsAPI.getStandings();
                    const standing = standingsRes.data.find(
                        (s: Standing & { teamId: number }) => s.teamId === roster.teamId
                    );
                    if (standing) setTeamStanding(standing);
                    setPlayerGoals(null);
                } else {
                    const [standingsRes, scorersRes] = await Promise.all([
                        statsAPI.getStandings(),
                        statsAPI.getTopScorers(),
                    ]);
                    const standing = standingsRes.data.find((s: Standing) => s.teamId === roster.teamId);
                    if (standing) setTeamStanding(standing);
                    const scorer = scorersRes.data.find((s: TopScorer) => s.memberId === roster.memberId);
                    setPlayerGoals(scorer ? scorer.goals : 0);
                }
            } catch (error) {
                console.error('Error fetching profile stats:', error);
            }
        };

        if (user) {
            fetchStats();
        }
    }, [user]);

    const loadPhase = useMinSkeletonTime(loading);

    if (loadPhase === 'spinner') {
        return <PageLoading label="טוען פרופיל..." />;
    }
    if (loadPhase === 'skeleton') {
        return <ProfileSkeleton label="טוען פרופיל..." />;
    }

    if (!user) return null;

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarLoading(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            await usersAPI.uploadAvatar(formData);
            await refreshUser();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בהעלאת תמונה');
        } finally {
            setAvatarLoading(false);
        }
    };

    const handleDeleteAvatar = async () => {
        const isUpload = user?.avatarUrl?.startsWith('/uploads/');
        const msg = isUpload
            ? 'להסיר את התמונה שהעלית? הפרופיל יישאר בלי תמונה (ניתן להעלות מחדש או לבחור תמונת Google).'
            : 'להסיר את תמונת הפרופיל?';
        if (!confirm(msg)) return;
        setAvatarLoading(true);
        try {
            await usersAPI.deleteAvatar();
            await refreshUser();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה במחיקת תמונה');
        } finally {
            setAvatarLoading(false);
        }
    };

    const handleUseGoogleAvatar = async () => {
        if (!confirm('להציג את תמונת Google בפרופיל בלבד? היא לא תופיע בכרטיס השחקן בקבוצה.')) return;
        setAvatarLoading(true);
        try {
            await usersAPI.useGoogleAvatar();
            await refreshUser();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בבחירת תמונת Google');
        } finally {
            setAvatarLoading(false);
        }
    };

    const handleTeamRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const slug = resolveRegistrationSlug(user);
        try {
            await registrationAPI.submitCreation(teamName, teamDesc, slug);
            setTeamRequestMsg(
                'הבקשה נשלחה וממתינה לאישור מנהל.'
            );
            setTeamName('');
            setTeamDesc('');
            await refreshUser();
        } catch (err: any) {
            setTeamRequestMsg(err.response?.data?.error || 'שגיאה בשליחת הבקשה');
        }
    };

    const handleCancelMapping = async () => {
        const confirmMsg = mappingStatus === 'pending'
            ? 'לבטל את בקשת השיוך הממתינה?'
            : 'לנקות את סטטוס השיוך שנדחה?';
        if (!confirm(confirmMsg)) return;
        try {
            await usersAPI.cancelPlayerMapping();
            await refreshUser();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בביטול הבקשה');
        }
    };

    const handleLeaveTeam = async () => {
        if (ownsTeam) {
            alert('בעל קבוצה לא יכול לעזוב. פנה למנהל');
            return;
        }
        if (!confirm('האם אתה בטוח שברצונך לעזוב את הקבוצה? פעולה זו תסיר את שיוכך כשחקן.')) return;
        try {
            await usersAPI.leaveTeam(registrationSlug);
            await refreshUser();
            alert('עזבת את הקבוצה בהצלחה');
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בעזיבת הקבוצה');
        }
    };

    const avatarSrc = resolveAssetUrl(user.avatarUrl) ?? null;

    const statusColors: Record<string, string> = {
        pending: 'warning',
        approved: 'success',
        rejected: 'danger',
    };

    const pendingCreation = divisionReg?.pendingCreation ?? user.pendingTeamRequest;
    const boysReg = user.tournamentRegistration?.boys;
    const girlsReg = user.tournamentRegistration?.girls;
    const isRegistrationActive = divisionReg?.status === 'active';
    const tr = user.tournamentRegistration;
    const usesPrdRegistration = !!(
        tr?.boys?.ownedTeamId ||
        tr?.girls?.ownedTeamId ||
        (tr?.boys?.status && tr.boys.status !== 'none') ||
        (tr?.girls?.status && tr.girls.status !== 'none')
    );
    const canRequestTeam =
        isRegistrationActive &&
        !divisionReg?.pendingCreation &&
        !divisionReg?.pendingJoin &&
        !divisionReg?.pendingTransfer &&
        (!pendingCreation || pendingCreation.status === 'rejected') &&
        !boysReg?.onRoster &&
        !boysReg?.ownedTeamId &&
        !girlsReg?.onRoster &&
        !girlsReg?.ownedTeamId;
    const mappingStatus = user.mappedPlayerInfo?.status;

    // We hide the status banner entirely once the user is actually a Player or Captain, 
    // because the 'Editable Player Info' card below is enough proof they are mapped.
    const showMappingBanner =
        mappingStatus &&
        !usesPrdRegistration &&
        !isOnRoster(user);
    const showLegacyCaptain = showLegacyCaptainPanel(user, usesPrdRegistration);
    const tournamentBadge = getProfileTournamentBadge(user);
    const platformAdmin = isPlatformAdmin(user);
    const showClaimBanner =
        !tournamentBadge &&
        (!mappingStatus || mappingStatus === 'rejected') &&
        hasClaimablePlayers === true;
    const focusIdentity = navFocusIdentity;
    const identityGateSlug = focusIdentity ?? registrationSlug;
    const claimNeedsIdentity = needsIdentitySubmission(user, identityGateSlug);
    const showManageableTeamPanel = !!manageableTeamId;
    const manageableTeamLabel =
        manageableTeamName || (manageableTeamId ? `קבוצה #${manageableTeamId}` : '');
    const claimTeamsPath = tournamentPaths[claimCheckSlug].teams;
    const showProfileIdentity =
        !!user.displayName || !!user.email || !!tournamentBadge || platformAdmin;

    return (
        <div className="profile-page">
            <SEO
                title="פרופיל אישי"
                description="עריכת פרופיל, תמונה ושיוך שחקן. מונדיאל קיץ 2026."
                pathname="/profile"
                noindex
            />
            <div className="container py-4" style={{ maxWidth: 760 }}>

                <div className="profile-page-header mb-3">
                    <h1 className="h4 mb-0">פרופיל אישי</h1>
                    {showProfileIdentity && (
                        <div className="profile-identity">
                            {user.displayName && (
                                <span className="profile-identity__name fw-semibold">{user.displayName}</span>
                            )}
                            {platformAdmin && <span className="badge bg-danger ms-1">מנהל</span>}
                            {(tournamentBadge === 'captain' ||
                                tournamentBadge === 'owner-captain' ||
                                tournamentBadge === 'owner-only') && (
                                <span className="ms-1">
                                    <TournamentRoleStar variant={tournamentBadge} showLabel />
                                </span>
                            )}
                            {tournamentBadge === 'player' && (
                                <span className="badge bg-secondary ms-1">שחקן</span>
                            )}
                            {!platformAdmin && !tournamentBadge && (
                                <span className="badge bg-secondary ms-1">
                                    {PROFILE_ROLE_LABELS[user.role] ?? user.role}
                                </span>
                            )}
                            {user.email && (
                                <span className="profile-identity__email text-muted small ms-2" dir="ltr">
                                    {user.email}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Player Mapping Status */}
                {showMappingBanner && mappingStatus && mappingStatus !== 'approved' && (
                    <div className={`alert alert-${statusColors[mappingStatus] ?? 'secondary'} mb-4`}>
                        {mappingStatus === 'pending' && (
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <i className="bi bi-hourglass-split me-2" />
                                    <strong>בקשת שיוך שחקן ממתינה לאישור קפטן.</strong>
                                    {user.mappedPlayerInfo?.teamName ? ` קבוצת ${user.mappedPlayerInfo.teamName} ` : ` קבוצה #${user.mappedPlayerInfo?.teamId} `}
                                    {user.mappedPlayerInfo?.playerName && `, השחקן ${user.mappedPlayerInfo.playerName} `}
                                </div>
                                <button type="button" className="btn btn-danger btn-sm" onClick={handleCancelMapping}>ביטול בקשה</button>
                            </div>
                        )}
                        {mappingStatus === 'rejected' && (
                            <div className="d-flex justify-content-between align-items-center">
                                <div><i className="bi bi-x-circle-fill me-2" /><strong>בקשת השיוך נדחתה.</strong> תוכל לנסות מחדש.</div>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCancelMapping}>נקה</button>
                            </div>
                        )}
                    </div>
                )}

                {identityFocusHint && (
                    <div className="alert alert-info py-2 small mb-3" role="status">
                        {identityFocusHint}
                    </div>
                )}

                <TournamentRegistrationCard
                    slug="boys"
                    title="רישום טורניר כדורגל"
                    hideJoinCta={showClaimBanner}
                />
                <TournamentRegistrationCard
                    slug="girls"
                    title="רישום טורניר בנות (נקודות)"
                    hideJoinCta={showClaimBanner}
                />

                {showClaimBanner && (
                    <div
                        className="alert custom-claim-banner custom-claim-banner--profile d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center justify-content-between gap-2 mb-4"
                        role="status"
                    >
                        <p className="mb-0">
                            <strong>שחקן בטורניר?</strong>{' '}
                            שייך את המשתמש שלך לשחקן קיים בסגל.
                        </p>
                        {claimNeedsIdentity ? (
                            <span className="small text-muted mb-0">
                                השלם תעודת זהות ושנת לידה בכרטיס הרישום למעלה.
                            </span>
                        ) : (
                            <Link
                                to={claimTeamsPath}
                                className="btn btn-sm btn-warning fw-semibold align-self-stretch align-self-sm-center"
                            >
                                שיוך בעמוד קבוצות
                            </Link>
                        )}
                    </div>
                )}

                {SHOW_PROFILE_TEAM_CREATION && canRequestTeam && (
                    <div className="card mb-4 p-4">
                        <h2 className="h5 mb-3">בקשה לפתיחת קבוצה חדשה</h2>
                        <p className="text-muted small mb-0">
                            הרישום פעיל. מלא שם קבוצה ושלח לאישור מנהל. בקשה אחת בלבד (הצטרפות או הקמה).
                        </p>
                        {teamRequestMsg && <div className={`alert ${teamRequestMsg.includes('שגיאה') ? 'alert-danger' : 'alert-success'} py-2`}>{teamRequestMsg}</div>}
                        {pendingCreation?.status === 'rejected' && (
                            <div className="alert alert-danger py-2 mb-3">הבקשה הקודמת שלך נדחתה. תוכל לשלוח בקשה חדשה.</div>
                        )}
                        <form onSubmit={handleTeamRequest}>
                            <div className="mb-3">
                                <label htmlFor="profile-team-name" className="form-label">שם הקבוצה</label>
                                <input id="profile-team-name" type="text" className="form-control" value={teamName} onChange={e => setTeamName(e.target.value)} required maxLength={TEAM_NAME_MAX_LEN} />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="profile-team-desc" className="form-label">תיאור קצר (אופציונלי)</label>
                                <textarea id="profile-team-desc" className="form-control" rows={3} value={teamDesc} onChange={e => setTeamDesc(e.target.value)} maxLength={TEAM_DESC_MAX_LEN} />
                            </div>
                            <button type="submit" className="btn btn-primary">שלח בקשה</button>
                        </form>
                    </div>
                )}

                {canEditPlayer && (
                    <div className="card mb-4 p-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2 className="h5 mb-0">פרטי שחקן</h2>
                            <div className="d-flex gap-2">
                                {!editingPlayer && (
                                    <>
                                        {canLeaveActiveRoster && (
                                            <button type="button" className="btn btn-danger btn-sm" onClick={handleLeaveTeam}>
                                                <i className="bi bi-box-arrow-right me-1" />עזוב קבוצה
                                            </button>
                                        )}
                                        <button type="button" className="btn btn-success btn-sm" onClick={startEditPlayer}>
                                            <i className="bi bi-pencil-fill me-1" />{playerProfile ? 'ערוך' : 'הגדר פרופיל'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {editingPlayer ? (
                            <form onSubmit={handleSavePlayer}>
                                <div className="row g-3">
                                    <div className="col-6">
                                        <label htmlFor="profile-player-firstName" className="form-label">שם פרטי *</label>
                                        <input id="profile-player-firstName" className="form-control" value={playerForm.firstName} maxLength={50}
                                            onChange={e => setPlayerForm(p => ({ ...p, firstName: e.target.value }))} required />
                                    </div>
                                    <div className="col-6">
                                        <label htmlFor="profile-player-lastName" className="form-label">שם משפחה *</label>
                                        <input id="profile-player-lastName" className="form-control" value={playerForm.lastName} maxLength={50}
                                            onChange={e => setPlayerForm(p => ({ ...p, lastName: e.target.value }))} required />
                                    </div>
                                    <div className="col-6">
                                        <label htmlFor="profile-player-nickname" className="form-label">כינוי / תג (ריק = שם משפחה)</label>
                                        <input id="profile-player-nickname" className="form-control" value={playerForm.nickname} maxLength={50}
                                            onChange={e => setPlayerForm(p => ({ ...p, nickname: e.target.value }))} />
                                    </div>
                                    <div className="col-3">
                                        <label htmlFor="profile-player-number" className="form-label">מספר</label>
                                        <input id="profile-player-number" type="number" className="form-control" value={playerForm.number} min={1} max={99}
                                            onChange={e => setPlayerForm(p => ({ ...p, number: e.target.value }))} />
                                    </div>
                                    <div className="col-3">
                                        <label htmlFor="profile-player-position" className="form-label">עמדה</label>
                                        <select id="profile-player-position" className="form-select" value={playerForm.position}
                                            onChange={e => setPlayerForm(p => ({ ...p, position: e.target.value }))}>
                                            <option value="">-</option>
                                            {['שוער', 'בלם', 'מגן', 'קשר', 'חלוץ'].map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label htmlFor="profile-player-bio" className="form-label">אודות</label>
                                        <textarea id="profile-player-bio" className="form-control" value={playerForm.bio || ''} maxLength={300} rows={3}
                                            onChange={e => setPlayerForm(p => ({ ...p, bio: e.target.value }))} placeholder="ספר מעט על עצמך..." />
                                    </div>
                                </div>
                                {playerMsg && (
                                    <div
                                        className={`alert ${
                                            playerMsg === 'הפרטים עודכנו בהצלחה'
                                                ? 'alert-success'
                                                : 'alert-danger'
                                        } py-2 mt-3`}
                                        role="alert"
                                    >
                                        {playerMsg}
                                    </div>
                                )}
                                <div className="d-flex gap-2 mt-3">
                                    <button type="button" className="btn btn-secondary" onClick={() => setEditingPlayer(false)}>בטל</button>
                                    <button type="submit" className="btn btn-success" disabled={playerSaving}>
                                        {playerSaving ? <span className="spinner-border spinner-border-sm" /> : 'שמור'}
                                    </button>
                                </div>
                            </form>
                        ) : playerProfile ? (
                            <div className="row g-2 text-end">
                                <div className="col-6"><span className="text-muted small">שם פרטי</span><div className="fw-semibold">{displayOrDash(playerProfile.firstName)}</div></div>
                                <div className="col-6"><span className="text-muted small">שם משפחה</span><div className="fw-semibold">{displayOrDash(playerProfile.lastName)}</div></div>
                                <div className="col-6"><span className="text-muted small">כינוי / תג</span><div className="fw-semibold">{displayOrDash(playerProfile.nickname)}</div></div>
                                <div className="col-3"><span className="text-muted small">מספר</span><div className="fw-semibold">{playerProfile.number ?? '-'}</div></div>
                                <div className="col-3"><span className="text-muted small">עמדה</span><div className="fw-semibold">{displayOrDash(playerProfile.position)}</div></div>
                                <div className="col-12 mt-3"><span className="text-muted small">אודות</span><div className="fw-semibold" style={{ whiteSpace: 'pre-line' }}>{displayOrDash(playerProfile.bio)}</div></div>
                            </div>
                        ) : (
                            <div className="text-center py-3 text-muted">
                                <i className="bi bi-person-badge fs-2 d-block mb-2" />
                                פרטי השחקן שלך טרם הוגדרו.
                                <br />
                                לחץ על 'הגדר פרופיל' כדי להתחיל.
                            </div>
                        )}
                        {!editingPlayer && playerMsg && <div className="alert alert-success py-2 mt-3">{playerMsg}</div>}
                    </div>
                )}

                {/* Team & Player Stats Card */}
                {(teamStanding || playerGoals !== null) && (
                    <div className="card mb-4 p-4 profile-stats-card">
                        <h2 className="h5 mb-4 d-flex align-items-center">
                            <i className="bi bi-bar-chart-fill me-2 text-primary" />
                            סטטיסטיקות טורניר: {rosterTeamName ?? `קבוצה #${onRoster?.teamId}`}
                        </h2>

                        <div className="row g-3 text-center">
                            {/* Individual Goals */}
                            {playerGoals !== null && (
                                <div className="col-6 col-md-3">
                                    <div className="stat-box bg-light rounded p-3 h-100 border border-success border-opacity-25">
                                        <div className="stat-value display-6 fw-bold text-success mb-1">{playerGoals}</div>
                                        <div className="stat-label text-muted small fw-semibold">שערי שחקן</div>
                                    </div>
                                </div>
                            )}

                            {/* Points */}
                            {teamStanding && (
                                <div className="col-6 col-md-3">
                                    <div className="stat-box bg-light rounded p-3 h-100">
                                        <div className="stat-value display-6 fw-bold text-theme-green mb-1">{teamStanding.points}</div>
                                        <div className="stat-label text-muted small fw-semibold">נקודות קבוצה</div>
                                    </div>
                                </div>
                            )}

                            {/* Position & Played */}
                            {teamStanding && (
                                <div className="col-6 col-md-3">
                                    <div className="stat-box bg-light rounded p-3 h-100">
                                        <div className="stat-value fs-4 fw-bold mb-1">{teamStanding.played}</div>
                                        <div className="stat-label text-muted small fw-semibold">משחקים ששוחקו</div>
                                    </div>
                                </div>
                            )}

                            {/* W/D/L */}
                            {teamStanding && (
                                <div className="col-6 col-md-3">
                                    <div className="stat-box bg-light rounded p-3 h-100">
                                        <div className="stat-value fs-5 fw-bold mb-1" dir="ltr">
                                            <span className="text-success">{teamStanding.won}</span> /&nbsp;
                                            <span className="text-warning">{teamStanding.drawn}</span> /&nbsp;
                                            <span className="text-danger">{teamStanding.lost}</span>
                                        </div>
                                        <div className="stat-label text-muted small fw-semibold">נצחונות / תיקו / הפסדים</div>
                                    </div>
                                </div>
                            )}

                            {/* Goals Info */}
                            {teamStanding && (
                                <div className="col-12 mt-3">
                                    <div className="d-flex justify-content-around bg-light rounded p-3 border">
                                        <div>
                                            <div className="small text-muted mb-1">שערי זכות (GF)</div>
                                            <div className="fw-bold fs-5 text-success">{teamStanding.goalsFor}</div>
                                        </div>
                                        <div>
                                            <div className="small text-muted mb-1">שערי חובה (GA)</div>
                                            <div className="fw-bold fs-5 text-danger">{teamStanding.goalsAgainst}</div>
                                        </div>
                                        <div>
                                            <div className="small text-muted mb-1">הפרש שערים (GD)</div>
                                            <div className="fw-bold fs-5" dir="ltr">
                                                {teamStanding.goalDifference > 0 ? '+' : ''}{teamStanding.goalDifference}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showManageableTeamPanel && manageableTeamId && (
                    <>
                        <TeamOwnerSettings
                            key={`${manageableSlug}-${manageableTeamId}`}
                            teamId={manageableTeamId}
                            slug={manageableSlug}
                            onUpdated={(snapshot) => {
                                if (snapshot?.name) setManageableTeamName(snapshot.name);
                            }}
                        />
                        <div className="card mb-4 p-4">
                            <h2 className="h5 mb-3 d-flex align-items-center">
                                <i className="bi bi-shield-check me-2" />
                                ניהול בקשות הצטרפות: {manageableTeamLabel}
                            </h2>
                            <TeamRegistrationActions
                                teamId={manageableTeamId}
                                teamName={manageableTeamLabel}
                                slug={manageableSlug}
                            />
                        </div>
                    </>
                )}

                {showLegacyCaptain && (
                    <div className="captain-management-zone">
                        <div className="card mb-4 premium-captain-card border-none overflow-hidden">
                            <div className="card-header bg-theme-green-gradient text-white p-3 border-none">
                                <h2 className="h5 mb-0 d-flex align-items-center">
                                    <i className="bi bi-shield-check me-2" />
                                    ניהול בקשות שחקנים לקבוצה שלך
                                </h2>
                            </div>
                            <div className="card-body p-4 bg-white">
                                <CaptainTeamRequests />
                            </div>
                        </div>
                    </div>
                )}

                <div className="card mb-4 p-4 profile-avatar-section">
                    <h2 className="h5 mb-3">תמונת פרופיל</h2>
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                        <label htmlFor="profile-avatar-upload" className="avatar-wrapper mb-0" title="שנה תמונה">
                            {avatarLoading ? (
                                <div className="avatar-placeholder"><span className="spinner-border spinner-border-sm" /></div>
                            ) : avatarSrc ? (
                                <img src={avatarSrc} alt={`תמונת פרופיל של ${user.displayName}`} className="avatar-img" />
                            ) : (
                                <div className="avatar-placeholder">
                                    <i className="bi bi-person-fill fs-1" />
                                </div>
                            )}
                            <span className="avatar-overlay" aria-hidden="true"><i className="bi bi-camera-fill" /></span>
                        </label>
                        <input id="profile-avatar-upload" type="file" ref={fileInputRef} accept="image/*" className="visually-hidden" onChange={handleAvatarChange} aria-label="העלאת תמונת פרופיל" />
                        {user.avatarUrl && (
                            <button
                                type="button"
                                className="btn btn-sm btn-danger profile-delete-avatar-btn"
                                onClick={handleDeleteAvatar}
                                disabled={avatarLoading}
                                title="הסר תמונת פרופיל"
                            >
                                <i className="bi bi-trash me-1" aria-hidden="true" />הסר תמונה
                            </button>
                        )}
                        {user.googlePictureUrl && user.avatarUrl !== user.googlePictureUrl && (
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary profile-delete-avatar-btn"
                                onClick={handleUseGoogleAvatar}
                                disabled={avatarLoading}
                                title="הצג תמונת Google בפרופיל בלבד (לא בקבוצה)"
                            >
                                <i className="bi bi-google me-1" aria-hidden="true" />תמונת Google
                            </button>
                        )}
                    </div>
                </div>

                <div className="pt-3 border-top text-center mb-2">
                    <button type="button" className="btn btn-danger profile-logout-btn" onClick={handleLogout}>
                        התנתק
                    </button>
                </div>

            </div>

        </div>
    );
};

export default Profile;
