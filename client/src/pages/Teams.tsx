import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { teamsAPI, votesAPI } from '../api/client';
import TeamRegistrationActions from '../components/registration/TeamRegistrationActions';
import TeamOwnerSettings from '../components/registration/TeamOwnerSettings';
import OwnerSquadRoles from '../components/registration/OwnerSquadRoles';
import RosterPlayerEditModal from '../components/registration/RosterPlayerEditModal';
import RosterPlayerRow from '../components/roster/RosterPlayerRow';
import { useAuth } from '../contexts/AuthContext';
import { useTournament } from '../contexts/TournamentContext';
import type { Player, Team } from '../types';
import SEO from '../components/SEO';
import AccessibleModal from '../components/AccessibleModal';
import { TeamsSkeleton } from '../components/skeleton';
import EmptyState from '../components/EmptyState';
import TournamentRoleStar from '../components/TournamentRoleStar';
import { PlayerHeadImg } from '../components/PlayerHeadImg';
import { resolveAssetUrl } from '../utils/assetUrl';
import { getRoleStarVariant, isPlatformAdmin } from '../utils/tournamentUser';
import { trackEvent } from '../utils/analytics';
import { shouldPollTournamentData } from '@ramadan-tournament/shared';
import { refreshPollMatchesRef, shouldRefreshPollMatches } from '../utils/tournamentPollMatches';
import { useMinSkeletonTime } from '../hooks/useMinSkeletonTime';
import { sortRosterPlayers } from '../utils/rosterSort';
import { displayNickname, fullName } from '../utils/playerDisplayName';
import { ShareButton } from '../components/share/ShareButton';
import { TeamShareCard } from '../components/share/TeamShareCard';
import { teamShareSnapshot } from '../utils/shareSnapshot';
import {
    computeTeamsBrowseSummary,
    filterRosterPlayers,
    getTeamTopScorer,
    sortTeamsById,
    teamHasPlayerMatch,
} from '../utils/teamsBrowse';

const Teams = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
    const [shouldScroll, setShouldScroll] = useState(false);
    const [myVote, setMyVote] = useState<{ playerMemberId: number } | null>(null);
    const [voteLoaded, setVoteLoaded] = useState(false);
    const [isVoting, setIsVoting] = useState(false);
    const [voteConfirmPlayer, setVoteConfirmPlayer] = useState<any | null>(null);
    const [loginPromptOpen, setLoginPromptOpen] = useState(false);
    const [dismissPrompt, setDismissPrompt] = useState(false);
    const ownerSettingsEditingRef = useRef(false);
    const pollMatchesRef = useRef<{ date: string }[]>([]);
    const handleOwnerSettingsEditingChange = useCallback((editing: boolean) => {
        ownerSettingsEditingRef.current = editing;
    }, []);
    const { user, loading: authLoading } = useAuth();
    const { slug } = useTournament();
    const location = useLocation();
    const navigate = useNavigate();
    // Check if user is logged in
    const isLoggedIn = !!user;

    useEffect(() => {
        const state = location.state as { expandTeamId?: number; selectPlayerId?: number };
        if (state?.expandTeamId) {
            setExpandedTeam(state.expandTeamId);
            setShouldScroll(true);
        }
        if (state?.selectPlayerId) {
            setSelectedPlayerId(state.selectPlayerId);
        }

        if (state?.expandTeamId || state?.selectPlayerId) {
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const showSkeleton = useMinSkeletonTime(loading, { error });

    useEffect(() => {
        // Wait until real list is painted — scroll while skeleton mounts misses team-row-*.
        if (showSkeleton || !shouldScroll || expandedTeam == null) return;

        let cancelled = false;
        let activeTimer: number | undefined;
        const maxAttempts = 12;
        const scrollBehavior: ScrollBehavior = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches
            ? 'auto'
            : 'smooth';

        const tryScroll = (attempt: number) => {
            if (cancelled) return;
            const wantPlayer = selectedPlayerId != null;
            const playerEl = wantPlayer
                ? document.getElementById(`player-card-${selectedPlayerId}`)
                : null;
            const teamEl = document.getElementById(`team-row-${expandedTeam}`);
            const isLast = attempt >= maxAttempts;

            // Prefer player when requested; only fall back to team on the last try.
            const target = wantPlayer
                ? (playerEl ?? (isLast ? teamEl : null))
                : teamEl;

            if (target) {
                target.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
                setShouldScroll(false);
                return;
            }
            if (!isLast) {
                activeTimer = window.setTimeout(() => tryScroll(attempt + 1), 50);
            } else {
                setShouldScroll(false);
            }
        };

        activeTimer = window.setTimeout(() => tryScroll(0), 50);
        return () => {
            cancelled = true;
            if (activeTimer != null) window.clearTimeout(activeTimer);
        };
    }, [showSkeleton, shouldScroll, expandedTeam, selectedPlayerId]);

    const fetchTeams = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const response = await teamsAPI.getAll(slug);
            setTeams(Array.isArray(response.data) ? response.data : []);
            if (!isBackground) setError('');
        } catch (err) {
            if (!isBackground) setError('שגיאה בטעינת קבוצות');
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    const fetchMyVote = async () => {
        if (authLoading) return;

        if (!isLoggedIn) {
            setVoteLoaded(true);
            return;
        }
        try {
            const response = await votesAPI.getMyVote('mvp');
            if (response.data.voted) {
                setMyVote({ playerMemberId: response.data.playerMemberId });
            }
        } catch (err) {
            console.error('Error fetching vote:', err);
        } finally {
            setVoteLoaded(true);
        }
    };

    useEffect(() => {
        fetchTeams();
        void refreshPollMatchesRef(pollMatchesRef);

        const interval = setInterval(() => {
            if (ownerSettingsEditingRef.current) return;
            void (async () => {
                if (shouldRefreshPollMatches(pollMatchesRef.current)) {
                    await refreshPollMatchesRef(pollMatchesRef);
                }
                if (shouldPollTournamentData(pollMatchesRef.current)) {
                    fetchTeams(true);
                }
            })();
        }, 30000);

        return () => clearInterval(interval);
    }, [slug]);

    useEffect(() => {
        fetchMyVote();
    }, [isLoggedIn, authLoading]);

    const [selectedPlayer, setSelectedPlayer] = useState<(Player & { teamId?: number }) | null>(null);
    const [editPlayer, setEditPlayer] = useState<(Player & { teamId: number }) | null>(null);

    const toggleTeam = (teamId: number) => {
        const nextExpanded = expandedTeam === teamId ? null : teamId;
        if (nextExpanded !== null) {
            trackEvent('team_expand', {
                category: 'browse',
                properties: { teamId, division: slug, expanded: true },
            });
        }
        setExpandedTeam(nextExpanded);
    };

    const filteredTeams = useMemo(() => {
        const sorted = sortTeamsById(teams);
        if (!query.trim()) return sorted;
        return sorted.filter((t) => teamHasPlayerMatch(t, query));
    }, [teams, query]);

    const browseSummary = useMemo(() => computeTeamsBrowseSummary(teams), [teams]);

    useEffect(() => {
        if (!query.trim()) return;
        if (filteredTeams.length === 0) {
            setExpandedTeam(null);
            return;
        }
        setExpandedTeam((prev) => {
            if (prev != null && filteredTeams.some((t) => t.id === prev)) return prev;
            return filteredTeams[0].id;
        });
    }, [query, filteredTeams]);

    const handleVoteClick = (player: Player & { teamId: number }, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isLoggedIn) {
            setLoginPromptOpen(true);
            return;
        }

        setVoteConfirmPlayer(player);
    };

    const confirmVote = async () => {
        const player = voteConfirmPlayer;
        if (!player || isVoting) return;

        try {
            setIsVoting(true);
            trackEvent('vote_submit', {
                category: 'interaction',
                properties: { division: slug, teamId: player.teamId },
            });
            const response = await votesAPI.cast(player.memberId, 'mvp');
            if (response.data.voted) {
                setMyVote({ playerMemberId: player.memberId });
            } else {
                setMyVote(null);
            }
        } catch (err: any) {
            console.error('Error casting vote:', err);
            alert(err.response?.data?.message || 'שגיאה בשליחת ההצבעה');
        } finally {
            setIsVoting(false);
            setVoteConfirmPlayer(null);
        }
    };

    if (showSkeleton) return <TeamsSkeleton label="טוען קבוצות..." />;
    if (error) return <div className="alert alert-danger m-3">{error}</div>;

    const selectedPlayerRoleStar = selectedPlayer
        ? getRoleStarVariant(!!selectedPlayer.isTeamOwner, selectedPlayer.isCaptain)
        : null;

    const canEditSelectedPlayer = (() => {
        if (!selectedPlayer?.teamId || !user) return false;
        if (isPlatformAdmin(user)) return true;
        const ownedTeamId =
            slug === 'boys' || slug === 'girls'
                ? user.tournamentRegistration?.[slug]?.ownedTeamId
                : undefined;
        const rosterReg =
            slug === 'boys' || slug === 'girls'
                ? user.tournamentRegistration?.[slug]?.onRoster
                : undefined;
        const isOwner = ownedTeamId === selectedPlayer.teamId;
        const isCaptain =
            rosterReg?.isCaptain === true && rosterReg.teamId === selectedPlayer.teamId;
        return isOwner || isCaptain;
    })();

    return (
        <div className="teams-browse-page container py-4">
            <SEO
                title="קבוצות ושחקנים"
                description="רשימת הקבוצות והסגלים המלאים של טורניר נצ'מאז 2026. הכירו את השחקנים, הקפטנים והסטטיסטיקות האישיות של כל קבוצה."
                pathname="/teams"
            />
            <h2 className="mb-0 fw-bold tournament-page-title">קבוצות הטורניר</h2>

            {teams.length === 0 ? (
                <EmptyState
                    title="אין קבוצות רשומות"
                    message="הקבוצות יופיעו כאן לאחר רישום ואישור בעונה הנוכחית."
                />
            ) : (
                <>
                    <p className="teams-browse-summary" aria-label="סיכום קבוצות">
                        <span>
                            <strong>{browseSummary.teamCount}</strong> קבוצות
                        </span>
                        <span className="teams-browse-summary-sep" aria-hidden="true">
                            ·
                        </span>
                        <span>
                            <strong>{browseSummary.playerCount}</strong> שחקנים
                        </span>
                        <span className="teams-browse-summary-sep" aria-hidden="true">
                            ·
                        </span>
                        <span>
                            <strong>{browseSummary.goalCount}</strong> שערים
                        </span>
                    </p>

                    {(voteLoaded && !dismissPrompt && (!isLoggedIn || !myVote)) && (
                        <div className="alert alert-warning alert-dismissible fade show mb-3 shadow-sm" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffecb3' }} role="alert">
                            <strong>{isLoggedIn ? 'טרם בחרת שחקן מצטיין!' : 'הצבעה ל-MVP:'}</strong>
                            <span className="ms-2">
                                {isLoggedIn
                                    ? 'לחץ על סימון הכוכב (⭐) בשורת השחקן בקבוצתו כדי לבחור בו כמצטיין!'
                                    : 'התחבר למערכת ולחץ על סימון הכוכב (⭐) בשורת השחקן בקבוצתו כדי לבחור בו כמצטיין!'}
                            </span>
                            <button type="button" className="btn-close" onClick={() => setDismissPrompt(true)} aria-label="סגור"></button>
                        </div>
                    )}

                    <div className="teams-browse-toolbar">
                        <label htmlFor="teams-browse-search" className="visually-hidden">
                            חיפוש שחקן
                        </label>
                        <input
                            id="teams-browse-search"
                            type="search"
                            className="form-control teams-browse-search"
                            placeholder="חיפוש שחקן..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    {filteredTeams.length === 0 ? (
                        <p className="text-muted text-center">לא נמצאו שחקנים התואמים לחיפוש.</p>
                    ) : (
                        <div className="teams-browse-list">
                            {filteredTeams.map((team) => {
                                const players = team.players ?? [];
                                const captain = players.find((p) => p.isCaptain);
                                const isExpanded = expandedTeam === team.id;
                                const logoSrc = resolveAssetUrl(team.logoUrl);
                                const ownedTeamId =
                                    slug === 'boys' || slug === 'girls'
                                        ? user?.tournamentRegistration?.[slug]?.ownedTeamId
                                        : undefined;
                                const rosterReg =
                                    slug === 'boys' || slug === 'girls'
                                        ? user?.tournamentRegistration?.[slug]?.onRoster
                                        : undefined;
                                const isOwner = ownedTeamId === team.id;
                                const isCaptain =
                                    rosterReg?.isCaptain === true && rosterReg.teamId === team.id;
                                const canManageBranding = isOwner || isCaptain;
                                const canEditSquadRoles = isOwner || isCaptain;
                                const captainName = captain
                                    ? `${captain.firstName} ${captain.lastName}`
                                    : null;
                                const visiblePlayers = filterRosterPlayers(
                                    sortRosterPlayers(players),
                                    query
                                );
                                const topScorerInTeam = getTeamTopScorer(players);

                                return (
                                    <article
                                        key={team.id}
                                        id={`team-row-${team.id}`}
                                        className={`teams-browse-card${isExpanded ? ' is-open' : ''}`}
                                    >
                                        <div className="teams-browse-header-row">
                                            <button
                                                type="button"
                                                className="teams-browse-header btn border-0 bg-transparent"
                                                aria-expanded={isExpanded}
                                                aria-controls={`team-details-${team.id}`}
                                                aria-label={
                                                    isExpanded
                                                        ? `כווץ פרטי ${team.name}`
                                                        : `הרחב פרטי ${team.name}`
                                                }
                                                onClick={() => toggleTeam(team.id)}
                                            >
                                                {logoSrc && team.logoPosition !== 'none' ? (
                                                    <img
                                                        className="teams-browse-crest"
                                                        src={logoSrc}
                                                        alt=""
                                                        width={44}
                                                        height={44}
                                                    />
                                                ) : null}
                                                <span className="teams-browse-title">
                                                    <span className="teams-browse-name">{team.name}</span>
                                                    <span className="teams-browse-meta">
                                                        <span className="teams-browse-meta-count">
                                                            {players.length} שחקנים
                                                        </span>
                                                        {captainName ? (
                                                            <>
                                                                <span
                                                                    className="teams-browse-summary-sep"
                                                                    aria-hidden="true"
                                                                >
                                                                    ·
                                                                </span>
                                                                <span className="teams-browse-meta-captain">
                                                                    <span className="teams-browse-meta-captain-label">
                                                                        קפטן
                                                                    </span>
                                                                    <span
                                                                        className="teams-browse-meta-captain-name"
                                                                        dir="auto"
                                                                    >
                                                                        {captainName}
                                                                    </span>
                                                                </span>
                                                            </>
                                                        ) : null}
                                                    </span>
                                                </span>
                                                <span className="teams-browse-chevron" aria-hidden="true">
                                                    <i
                                                        className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}
                                                    />
                                                </span>
                                            </button>
                                            <ShareButton
                                                filename={`team-${team.id}.png`}
                                                snapshot={teamShareSnapshot(
                                                    team,
                                                    team.logoPosition === 'none' ? undefined : logoSrc
                                                )}
                                                title={team.name}
                                                text={`סגל קבוצת ${team.name}`}
                                                prepare={async () => ({
                                                    team,
                                                    logoSrc:
                                                        team.logoPosition === 'none'
                                                            ? undefined
                                                            : logoSrc,
                                                })}
                                                renderContent={(prepared) =>
                                                    prepared ? (
                                                        <TeamShareCard
                                                            team={prepared.team}
                                                            logoSrc={prepared.logoSrc}
                                                        />
                                                    ) : null
                                                }
                                            />
                                        </div>

                                        {isExpanded ? (
                                            <div
                                                className="teams-browse-squad"
                                                id={`team-details-${team.id}`}
                                            >
                                                {team.description && !canManageBranding ? (
                                                    <p className="text-muted small mb-3">{team.description}</p>
                                                ) : null}
                                                {canManageBranding ? (
                                                    <TeamOwnerSettings
                                                        key={`owner-settings-${slug}-${team.id}`}
                                                        teamId={team.id}
                                                        slug={slug}
                                                        variant="inline"
                                                        initialTeam={{
                                                            name: team.name,
                                                            description: team.description,
                                                            logoUrl: team.logoUrl,
                                                            customLogoUrl: team.customLogoUrl,
                                                            logoPosition: team.logoPosition,
                                                        }}
                                                        onEditingChange={handleOwnerSettingsEditingChange}
                                                        onUpdated={() => void fetchTeams(true)}
                                                    />
                                                ) : null}
                                                <TeamRegistrationActions
                                                    teamId={team.id}
                                                    teamName={team.name}
                                                    slug={slug}
                                                />
                                                {canEditSquadRoles ? (
                                                    <OwnerSquadRoles
                                                        key={team.id}
                                                        teamId={team.id}
                                                        players={players}
                                                        slug={slug}
                                                        onSaved={() => void fetchTeams(true)}
                                                    />
                                                ) : null}
                                                {players.length === 0 ? (
                                                    <p className="text-muted small mb-0">אין שחקנים רשומים</p>
                                                ) : (
                                                    <div className="roster-table">
                                                        <div className="roster-table-head roster-table-head--vote">
                                                            <span className="roster-col-vote" title="הצבעה" aria-hidden="true">
                                                              ★
                                                            </span>
                                                            <span className="roster-col-num">#</span>
                                                            <span className="roster-col-player">שחקן</span>
                                                            <span className="roster-col-pos">עמדה</span>
                                                            <span className="roster-col-stats">
                                                              <span>שערים</span>
                                                              <span>ממוצע</span>
                                                            </span>
                                                        </div>
                                                        <ul className="roster-player-list">
                                                            {visiblePlayers.map((player) => {
                                                                const isTopScorer =
                                                                    !!topScorerInTeam &&
                                                                    player.memberId ===
                                                                        topScorerInTeam.memberId;
                                                                return (
                                                                    <RosterPlayerRow
                                                                        key={player.memberId}
                                                                        player={player}
                                                                        teamId={team.id}
                                                                        isTopScorer={isTopScorer}
                                                                        selected={
                                                                            selectedPlayerId ===
                                                                            player.memberId
                                                                        }
                                                                        showVote
                                                                        myVoteMemberId={
                                                                            myVote?.playerMemberId ?? null
                                                                        }
                                                                        isVoting={isVoting}
                                                                        onVote={handleVoteClick}
                                                                        onOpen={setSelectedPlayer}
                                                                    />
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <AccessibleModal open={!!selectedPlayer} onClose={() => setSelectedPlayer(null)} titleId="player-modal-title">
                        <div className="modal-content">
                            <div className="modal-header bg-success text-white">
                                <h2 id="player-modal-title" className="modal-title h5">{selectedPlayer ? fullName(selectedPlayer) : ''}</h2>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedPlayer(null)} aria-label="סגור"></button>
                            </div>
                            {selectedPlayer && (
                            <div className="modal-body text-center">
                                <PlayerHeadImg
                                    player={selectedPlayer}
                                    alt={`תמונת ${fullName(selectedPlayer)}`}
                                    className="rounded-circle mb-3 border border-3 border-warning"
                                    style={{ width: '120px', height: '120px', objectFit: 'cover' }}
                                />
                                <h4>{displayNickname(selectedPlayer)}</h4>
                                <div className="d-flex justify-content-center gap-2 mb-3">
                                    <span className="badge bg-success fs-6">{selectedPlayer.number}</span>
                                    <span className="badge bg-secondary fs-6">{selectedPlayer.position}</span>
                                    {selectedPlayerRoleStar ? (
                                        <TournamentRoleStar variant={selectedPlayerRoleStar} showLabel size="lg" />
                                    ) : null}
                                </div>
                                <div className="d-flex justify-content-center gap-4 mb-3 py-2 bg-light rounded">
                                    <div className="text-center">
                                        <div className="small text-muted">סה"כ שערים</div>
                                        <div className="fs-4 fw-bold text-success">{selectedPlayer.totalGoals || 0}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="small text-muted">משחקים</div>
                                        <div className="fs-4 fw-bold text-dark">{selectedPlayer.gamesPlayed || 0}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="small text-muted">ממוצע למשחק</div>
                                        <div className="fs-4 fw-bold text-primary">
                                            {(selectedPlayer.totalGoals && selectedPlayer.gamesPlayed)
                                                ? (selectedPlayer.totalGoals / selectedPlayer.gamesPlayed).toFixed(2)
                                                : '0.00'}
                                        </div>
                                    </div>
                                </div>
                                <hr />
                                <div className="text-end">
                                    <h6 className="fw-bold text-success">אודות השחקן:</h6>
                                    <p>{selectedPlayer.bio || 'אין מידע נוסף אודות השחקן.'}</p>
                                </div>
                            </div>
                            )}
                            <div className="modal-footer">
                                {canEditSelectedPlayer && selectedPlayer?.teamId != null ? (
                                    <button
                                        type="button"
                                        className="btn btn-outline-success"
                                        onClick={() => {
                                            setEditPlayer({
                                                ...selectedPlayer,
                                                teamId: selectedPlayer.teamId!,
                                            });
                                            setSelectedPlayer(null);
                                        }}
                                    >
                                        ערוך שחקן
                                    </button>
                                ) : null}
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPlayer(null)}>סגור</button>
                            </div>
                        </div>
            </AccessibleModal>

            {editPlayer ? (
                <RosterPlayerEditModal
                    key={`edit-${editPlayer.memberId}`}
                    open
                    onClose={() => setEditPlayer(null)}
                    teamId={editPlayer.teamId}
                    player={editPlayer}
                    slug={slug}
                    onSaved={() => void fetchTeams(true)}
                />
            ) : null}

            <AccessibleModal
                open={!!voteConfirmPlayer}
                onClose={() => !isVoting && setVoteConfirmPlayer(null)}
                titleId="vote-modal-title"
            >
                {voteConfirmPlayer ? (
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-success text-white">
                                <h2 id="vote-modal-title" className="modal-title h5">
                                    <i className={`fa-solid ${myVote?.playerMemberId === voteConfirmPlayer?.memberId ? 'fa-star-half-stroke text-danger' : 'fa-star text-warning'} ms-2`} aria-hidden="true"></i>
                                    אישור הצבעה
                                </h2>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setVoteConfirmPlayer(null)} disabled={isVoting} aria-label="סגור"></button>
                            </div>
                            <div className="modal-body text-center p-4">
                                <h5 className="mb-3">
                                    {myVote?.playerMemberId === voteConfirmPlayer.memberId
                                        ? 'האם אתה בטוח שברצונך לבטל את ההצבעה שלך עבור'
                                        : 'האם אתה בטוח שברצונך להצביע עבור'}
                                </h5>
                                <h4 className="fw-bold text-success mb-2">
                                    {voteConfirmPlayer.firstName} {voteConfirmPlayer.lastName}
                                </h4>
                                {voteConfirmPlayer.nickname && (
                                    <div className="text-muted">({voteConfirmPlayer.nickname})</div>
                                )}
                                {!myVote || myVote.playerMemberId === voteConfirmPlayer.memberId ? (
                                    <p className="mt-3 text-muted small">
                                        {myVote?.playerMemberId === voteConfirmPlayer.memberId
                                            ? 'ביטול ההצבעה יאפשר לך להצביע לשחקן אחר.'
                                            : 'ניתן להצביע לשחקן אחד בלבד בטורניר. בכל פעם תוכל לשנות את בחירתך.'}
                                    </p>
                                ) : (
                                    <p className="mt-4 text-warning fw-bold bg-light p-2 rounded border border-warning">
                                        שים לב: הצבעה זו תחליף את הצבעתך הקודמת בטורניר.
                                    </p>
                                )}
                            </div>
                            <div className="modal-footer justify-content-center bg-light">
                                <button type="button" className="btn btn-secondary px-4 fw-bold" onClick={() => setVoteConfirmPlayer(null)} disabled={isVoting}>
                                    ביטול
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${myVote?.playerMemberId === voteConfirmPlayer?.memberId ? 'btn-danger' : 'btn-success'} px-4 fw-bold`}
                                    onClick={confirmVote}
                                    disabled={isVoting}
                                >
                                    {isVoting ? (
                                        <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> מעדכן...</>
                                    ) : (
                                        myVote?.playerMemberId === voteConfirmPlayer?.memberId ? 'בטל הצבעה' : 'אשר הצבעה'
                                    )}
                                </button>
                            </div>
                        </div>
                ) : null}
            </AccessibleModal>

            <AccessibleModal
                open={loginPromptOpen}
                onClose={() => setLoginPromptOpen(false)}
                titleId="login-prompt-title"
            >
                <div className="modal-content border-0 shadow">
                    <div className="modal-header">
                        <h2 id="login-prompt-title" className="modal-title h5">נדרשת התחברות</h2>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={() => setLoginPromptOpen(false)}
                            aria-label="סגור"
                        />
                    </div>
                    <div className="modal-body">
                        <p className="mb-0">
                            יש להתחבר כדי להצביע לשחקן הטורניר. לעבור לעמוד ההתחברות?
                        </p>
                    </div>
                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setLoginPromptOpen(false)}
                        >
                            ביטול
                        </button>
                        <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => {
                                setLoginPromptOpen(false);
                                navigate('/login');
                            }}
                        >
                            התחברות
                        </button>
                    </div>
                </div>
            </AccessibleModal>
        </div>
    );
};

export default Teams;
