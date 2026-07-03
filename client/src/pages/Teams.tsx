import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { teamsAPI, votesAPI } from '../api/client';
import TeamRegistrationActions from '../components/registration/TeamRegistrationActions';
import TeamOwnerSettings from '../components/registration/TeamOwnerSettings';
import OwnerSquadRoles from '../components/registration/OwnerSquadRoles';
import { useAuth } from '../contexts/AuthContext';
import { useTournament } from '../contexts/TournamentContext';
import type { Team } from '../types';
import SEO from '../components/SEO';
import AccessibleModal from '../components/AccessibleModal';
import PageLoading from '../components/PageLoading';
import EmptyState from '../components/EmptyState';
import TournamentRoleStar from '../components/TournamentRoleStar';
import { PlayerHeadImg } from '../components/PlayerHeadImg';
import { resolveAssetUrl } from '../utils/assetUrl';
import { getRoleStarVariant } from '../utils/tournamentUser';
import { trackEvent } from '../utils/analytics';
import { shouldPollTournamentData } from '@ramadan-tournament/shared';
import { refreshPollMatchesRef, shouldRefreshPollMatches } from '../utils/tournamentPollMatches';

const Teams = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
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
            // If we don't have an expandTeamId but have a player, we'll need to expand their team
            // But usually they come together
        }

        if (state?.expandTeamId || state?.selectPlayerId) {
            // Clear state so it doesn't persist on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    useEffect(() => {
        if (!loading && shouldScroll && expandedTeam) {
            // Short delay to ensure DOM is fully ready after loading state change
            const timer = setTimeout(() => {
                const element = document.getElementById(`team-row-${expandedTeam}`);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    // Align to top with 100px offset to account for sticky header and provide margin
                    let targetY = rect.top + scrollTop - 100;

                    // If we have a selected player, try to scroll specifically to them inside the expanded team
                    if (selectedPlayerId) {
                        const playerElement = document.getElementById(`player-card-${selectedPlayerId}`);
                        if (playerElement) {
                            const pRect = playerElement.getBoundingClientRect();
                            targetY = pRect.top + scrollTop - 150; // A bit more margin for player cards
                        }
                    }

                    window.scrollTo({
                        top: targetY,
                        behavior: 'smooth'
                    });
                    setShouldScroll(false);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [loading, shouldScroll, expandedTeam]);

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

    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

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

    const handleTeamRowClick = (e: React.MouseEvent, teamId: number) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, [data-no-row-toggle]')) {
            return;
        }
        toggleTeam(teamId);
    };

    const handleTeamRowKeyDown = (e: React.KeyboardEvent, teamId: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTeam(teamId);
        }
    };

    const handleVoteClick = (player: any, e: React.MouseEvent) => {
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

    if (loading) return <PageLoading label="טוען קבוצות..." />;
    if (error) return <div className="alert alert-danger m-3">{error}</div>;

    const selectedPlayerRoleStar = selectedPlayer
        ? getRoleStarVariant(!!selectedPlayer.isTeamOwner, selectedPlayer.isCaptain)
        : null;

    return (
        <div className="container py-4">
            <SEO
                title="קבוצות ושחקנים"
                description="רשימת הקבוצות והסגלים המלאים של טורניר נצ'מאז 2026. הכירו את השחקנים, הקפטנים והסטטיסטיקות האישיות של כל קבוצה."
                pathname="/teams"
            />
            <h2 className="mb-4 fw-bold text-success border-bottom pb-2">קבוצות הטורניר</h2>

            {teams.length === 0 ? (
                <EmptyState
                    title="אין קבוצות רשומות"
                    message="הקבוצות יופיעו כאן לאחר רישום ואישור בעונה הנוכחית."
                />
            ) : (
                <>
                    {(voteLoaded && !dismissPrompt && (!isLoggedIn || !myVote)) && (
                        <div className="alert alert-warning alert-dismissible fade show mb-4 shadow-sm" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffecb3' }} role="alert">
                            <strong>{isLoggedIn ? 'טרם בחרת שחקן מצטיין!' : 'הצבעה ל-MVP:'}</strong>
                            <span className="ms-2">
                                {isLoggedIn
                                    ? 'לחץ על סימון הכוכב (⭐) בכרטסייה של השחקן בקבוצתו כדי לבחור בו כמצטיין!'
                                    : 'התחבר למערכת ולחץ על סימון הכוכב (⭐) בכרטסייה של השחקן בקבוצתו כדי לבחור בו כמצטיין!'}
                            </span>
                            <button type="button" className="btn-close" onClick={() => setDismissPrompt(true)} aria-label="סגור"></button>
                        </div>
                    )}

                    <div className="table-responsive">
                <table className="table table-hover" id="teamsTable">
                    <caption className="visually-hidden">רשימת קבוצות הטורניר</caption>
                    <thead>
                        <tr>
                            <th scope="col">ID</th>
                            <th scope="col">שם הקבוצה</th>
                            <th scope="col" className="d-none d-md-table-cell">מספר שחקנים</th>
                            <th scope="col">קפטן</th>
                            <th scope="col"><span className="visually-hidden">הרחבה</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map((team) => {
                            const players = team.players ?? [];
                            const captain = players.find(p => p.isCaptain);
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
                            const canEditSquadRoles = isOwner || isCaptain;

                            return (
                                <Fragment key={team.id}>
                                    <tr
                                        id={`team-row-${team.id}`}
                                        className={`team-row ${isExpanded ? 'bg-light' : ''}`}
                                        role="button"
                                        tabIndex={0}
                                        aria-expanded={isExpanded}
                                        aria-controls={`team-details-${team.id}`}
                                        aria-label={isExpanded ? `כווץ פרטי ${team.name}` : `הרחב פרטי ${team.name}`}
                                        onClick={(e) => handleTeamRowClick(e, team.id)}
                                        onKeyDown={(e) => handleTeamRowKeyDown(e, team.id)}
                                    >
                                        <td>{team.id}</td>
                                        <td className="fw-bold fs-8">
                                            <div className="d-flex align-items-center gap-2">
                                                {team.logoPosition === 'right' && logoSrc && (
                                                    <img className="team-logo-inline" src={logoSrc} alt={`לוגו ${team.name}`} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                                )}
                                                <span>{team.name}</span>
                                                {team.logoPosition === 'left' && logoSrc && (
                                                    <img className="team-logo-inline" src={logoSrc} alt={`לוגו ${team.name}`} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                                )}
                                            </div>
                                        </td>
                                        <td className="d-none d-md-table-cell">{players.length}</td>
                                        <td>{captain ? `${captain.firstName} ${captain.lastName}` : 'אין'}</td>
                                        <td>
                                            <span className="expand-icon" aria-hidden="true">
                                                {isExpanded ? '▼' : '►'}
                                            </span>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="team-details-row" id={`team-details-${team.id}`}>
                                            <td colSpan={5} className="bg-light p-3">
                                                {team.description && !isOwner ? (
                                                    <p className="text-muted small mb-3">{team.description}</p>
                                                ) : null}
                                                {isOwner && (
                                                    <TeamOwnerSettings
                                                        key={`owner-settings-${slug}-${team.id}`}
                                                        teamId={team.id}
                                                        slug={slug}
                                                        variant="inline"
                                                        initialTeam={{
                                                            name: team.name,
                                                            description: team.description,
                                                            logoUrl: team.logoUrl,
                                                            logoPosition: team.logoPosition,
                                                        }}
                                                        onEditingChange={handleOwnerSettingsEditingChange}
                                                        onUpdated={() => void fetchTeams(true)}
                                                    />
                                                )}
                                                <TeamRegistrationActions
                                                    teamId={team.id}
                                                    teamName={team.name}
                                                    slug={slug}
                                                />
                                                {canEditSquadRoles && (
                                                    <OwnerSquadRoles
                                                        key={team.id}
                                                        teamId={team.id}
                                                        players={players}
                                                        slug={slug}
                                                        onSaved={() => void fetchTeams(true)}
                                                    />
                                                )}
                                                <div className="row g-3">
                                                    {(() => {
                                                        const topScorerInTeam = [...players].sort((a, b) => {
                                                            const goalsA = a.totalGoals || 0;
                                                            const goalsB = b.totalGoals || 0;
                                                            if (goalsB !== goalsA) return goalsB - goalsA;
                                                            const avgA = (a.totalGoals && a.gamesPlayed) ? a.totalGoals / a.gamesPlayed : 0;
                                                            const avgB = (b.totalGoals && b.gamesPlayed) ? b.totalGoals / b.gamesPlayed : 0;
                                                            return avgB - avgA;
                                                        })[0];

                                                        return players.map(player => {
                                                            const isTopScorer = topScorerInTeam && player.memberId === topScorerInTeam.memberId && (player.totalGoals || 0) > 0;
                                                            const roleStarVariant = getRoleStarVariant(
                                                                !!player.isTeamOwner,
                                                                player.isCaptain
                                                            );

                                                            return (
                                                                <div key={player.memberId} className="col-6 col-md-4 col-lg-3">
                                                                    <div
                                                                        id={`player-card-${player.memberId}`}
                                                                        className={`roster-player-card position-relative ${isTopScorer ? 'top-scorer-highlight' : ''} ${selectedPlayerId === player.memberId ? 'selected' : ''}`}
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleVoteClick(player, e)}
                                                                            className="btn btn-sm position-absolute top-0 start-0 m-1 p-1 border-0 bg-transparent"
                                                                            style={{ zIndex: 10 }}
                                                                            aria-label={myVote?.playerMemberId === player.memberId ? `בטל הצבעה ל${player.firstName} ${player.lastName}` : `הצבע ל${player.firstName} ${player.lastName} כמצטיין`}
                                                                            aria-pressed={myVote?.playerMemberId === player.memberId}
                                                                            disabled={isVoting}
                                                                        >
                                                                            <i className={`fs-5 ${myVote?.playerMemberId === player.memberId ? 'text-warning fa-solid fa-star' : 'text-secondary fa-regular fa-star'}`} aria-hidden="true"></i>
                                                                        </button>
                                                                        {roleStarVariant ? (
                                                                            <span
                                                                                className="position-absolute top-0 end-0 m-2 mt-4"
                                                                                style={{ zIndex: 5 }}
                                                                                aria-hidden="true"
                                                                            >
                                                                                <TournamentRoleStar variant={roleStarVariant} size="sm" decorative />
                                                                            </span>
                                                                        ) : null}
                                                                        <button
                                                                            type="button"
                                                                            className="roster-player-card-open w-100 border-0 bg-transparent text-center p-0 pt-4"
                                                                            onClick={() => setSelectedPlayer(player)}
                                                                            aria-label={`פרטי שחקן ${player.firstName} ${player.lastName}`}
                                                                        >
                                                                        {isTopScorer && (
                                                                            <span className="badge text-dark position-absolute top-0 end-0 m-2" aria-label="מלך השערים של הקבוצה">⚽</span>
                                                                        )}
                                                                        <div className="fw-bold mt-2">{player.nickname}</div>
                                                                        <div className="text-muted small">{player.firstName} {player.lastName}</div>
                                                                        <div className="badge bg-success mt-1">{player.number}</div>
                                                                        <div className="small text-secondary">{player.position}</div>
                                                                        <div className="mt-2 pt-2 border-top player-card-stats">
                                                                            <div className="d-flex justify-content-between small">
                                                                                <span className="text-muted">שערים:</span>
                                                                                <span className="fw-bold text-success">{player.totalGoals || 0}</span>
                                                                            </div>
                                                                            <div className="d-flex justify-content-between small">
                                                                                <span className="text-muted">ממוצע:</span>
                                                                                <span className="text-muted">
                                                                                    {(player.totalGoals && player.gamesPlayed)
                                                                                        ? (player.totalGoals / player.gamesPlayed).toFixed(2)
                                                                                        : '0.00'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
                    </div>
                </>
            )}

            {/* Player Details Modal */}
            <AccessibleModal open={!!selectedPlayer} onClose={() => setSelectedPlayer(null)} titleId="player-modal-title">
                        <div className="modal-content">
                            <div className="modal-header bg-success text-white">
                                <h2 id="player-modal-title" className="modal-title h5">{selectedPlayer?.firstName} {selectedPlayer?.lastName}</h2>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedPlayer(null)} aria-label="סגור"></button>
                            </div>
                            {selectedPlayer && (
                            <div className="modal-body text-center">
                                <PlayerHeadImg
                                    player={selectedPlayer}
                                    alt={`תמונת ${selectedPlayer.firstName} ${selectedPlayer.lastName}`}
                                    className="rounded-circle mb-3 border border-3 border-warning"
                                    style={{ width: '120px', height: '120px', objectFit: 'cover' }}
                                />
                                <h4>{selectedPlayer.nickname}</h4>
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
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPlayer(null)}>סגור</button>
                            </div>
                        </div>
            </AccessibleModal>

            {/* Vote Confirmation Modal */}
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
