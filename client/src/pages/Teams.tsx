import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { teamsAPI, votesAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Team } from '../types';
import SEO from '../components/SEO';

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
    const [dismissPrompt, setDismissPrompt] = useState(false);
    const { user, loading: authLoading } = useAuth();
    const location = useLocation();

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
            const response = await teamsAPI.getAll();
            setTeams(response.data);
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

        const interval = setInterval(() => {
            const hour = new Date().getHours();
            if (hour >= 20 && hour <= 23) {
                fetchTeams(true);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchMyVote();
    }, [isLoggedIn, authLoading]);

    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

    const toggleTeam = (teamId: number) => {
        setExpandedTeam(expandedTeam === teamId ? null : teamId);
    };

    const handleVoteClick = (player: any, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isLoggedIn) {
            if (window.confirm('יש להתחבר כדי להצביע לשחקן הטורניר! האם תרצה לעבור לעמוד ההתחברות?')) {
                // Navigate to login, and optionally pass a returnTo state so they come back to teams
                // Assuming standard login behavior redirects to dashboard, we just go to login for now.
                window.location.href = '/login';
            }
            return;
        }

        setVoteConfirmPlayer(player);
    };

    const confirmVote = async () => {
        if (!voteConfirmPlayer || isVoting) return;

        try {
            setIsVoting(true);
            const response = await votesAPI.cast(voteConfirmPlayer.memberId, 'mvp');
            if (response.data.voted) {
                setMyVote({ playerMemberId: voteConfirmPlayer.memberId });
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

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-success" role="status"><span className="visually-hidden">טוען...</span></div></div>;
    if (error) return <div className="alert alert-danger m-3">{error}</div>;

    return (
        <div className="container py-4">
            <SEO
                title="קבוצות ושחקנים"
                description="רשימת הקבוצות והסגלים המלאים של טורניר נצ'מאז 2026. הכירו את השחקנים, הקפטנים והסטטיסטיקות האישיות של כל קבוצה."
                url="https://ramadan-tournament-client.vercel.app/teams"
            />
            <h2 className="mb-4 fw-bold text-success border-bottom pb-2">קבוצות הטורניר</h2>

            {(voteLoaded && !dismissPrompt && (!isLoggedIn || !myVote)) && (
                <div className="alert alert-warning alert-dismissible fade show mb-4 shadow-sm" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffecb3' }} role="alert">
                    <strong>{isLoggedIn ? 'טרם בחרת שחקן מצטיין!' : 'הצבעה ל-MVP:'}</strong> 
                    <span className="ms-2">
                        {isLoggedIn 
                            ? 'לחץ על סימון הכוכב (⭐) בכרטסייה של השחקן בקבוצתו כדי לבחור בו כמצטיין!' 
                            : 'התחבר למערכת ולחץ על סימון הכוכב (⭐) בכרטסייה של השחקן בקבוצתו כדי לבחור בו כמצטיין!'}
                    </span>
                    <button type="button" className="btn-close" onClick={() => setDismissPrompt(true)} aria-label="Close"></button>
                </div>
            )}

            <div className="table-responsive">
                <table className="table table-hover" id="teamsTable">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>שם הקבוצה</th>
                            <th className="d-none d-md-table-cell">מספר שחקנים</th>
                            <th>קפטן</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map((team) => {
                            const captain = team.players.find(p => p.isCaptain);
                            const isExpanded = expandedTeam === team.id;

                            return (
                                <>
                                    <tr
                                        id={`team-row-${team.id}`}
                                        className={`team-row ${isExpanded ? 'bg-light' : ''}`}
                                        onClick={() => toggleTeam(team.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>{team.id}</td>
                                        <td className="fw-bold fs-8">
                                            <div className="d-flex align-items-center gap-2">
                                                {team.logoPosition === 'right' && team.logoUrl && (
                                                    <img className="team-logo-inline" src={team.logoUrl.startsWith('http') ? team.logoUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')}${team.logoUrl}`} alt={`${team.name} Logo`} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                                )}
                                                <span>{team.name}</span>
                                                {team.logoPosition === 'left' && team.logoUrl && (
                                                    <img className="team-logo-inline" src={team.logoUrl.startsWith('http') ? team.logoUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')}${team.logoUrl}`} alt={`${team.name} Logo`} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                                )}
                                            </div>
                                        </td>
                                        <td className="d-none d-md-table-cell">{team.players.length}</td>
                                        <td>{captain ? `${captain.firstName} ${captain.lastName}` : 'אין'}</td>
                                        <td>
                                            <span className="expand-icon">
                                                {isExpanded ? '▼' : '►'}
                                            </span>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="team-details-row">
                                            <td colSpan={5} className="bg-light p-3">
                                                <div className="row g-3">
                                                    {(() => {
                                                        const topScorerInTeam = [...team.players].sort((a, b) => {
                                                            const goalsA = a.totalGoals || 0;
                                                            const goalsB = b.totalGoals || 0;
                                                            if (goalsB !== goalsA) return goalsB - goalsA;
                                                            const avgA = (a.totalGoals && a.gamesPlayed) ? a.totalGoals / a.gamesPlayed : 0;
                                                            const avgB = (b.totalGoals && b.gamesPlayed) ? b.totalGoals / b.gamesPlayed : 0;
                                                            return avgB - avgA;
                                                        })[0];

                                                        return team.players.map(player => {
                                                            const isTopScorer = topScorerInTeam && player.memberId === topScorerInTeam.memberId && (player.totalGoals || 0) > 0;

                                                            return (
                                                                <div key={player.memberId} className="col-6 col-md-4 col-lg-3">
                                                                    <div
                                                                        id={`player-card-${player.memberId}`}
                                                                        className={`roster-player-card position-relative ${isTopScorer ? 'top-scorer-highlight' : ''} ${selectedPlayerId === player.memberId ? 'selected' : ''}`}
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); }}
                                                                        style={{ cursor: 'pointer' }}
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleVoteClick(player, e)}
                                                                            className="btn btn-sm position-absolute top-0 start-0 m-1 p-1 border-0 bg-transparent"
                                                                            style={{ zIndex: 10 }}
                                                                            title={myVote?.playerMemberId === player.memberId ? "הצבעת לשחקן זה" : "הצבע לשחקן המצטיין"}
                                                                            disabled={isVoting}
                                                                        >
                                                                            <i className={`fs-5 ${myVote?.playerMemberId === player.memberId ? 'text-warning fa-solid fa-star' : 'text-secondary fa-regular fa-star'}`}></i>
                                                                        </button>

                                                                        {player.isCaptain && <span className="badge text-dark position-absolute top-0 end-0 m-2 mt-4">⭐</span>}
                                                                        {isTopScorer && <span className="badge text-dark position-absolute top-0 end-0 m-2" title="מלך השערים של הקבוצה">⚽</span>}
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
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Player Details Modal */}
            {selectedPlayer && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setSelectedPlayer(null)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                        <div className="modal-content">
                            <div className="modal-header bg-success text-white">
                                <h5 className="modal-title">{selectedPlayer.firstName} {selectedPlayer.lastName}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedPlayer(null)}></button>
                            </div>
                            <div className="modal-body text-center">
                                <img
                                    src={selectedPlayer.head_photo
                                        ? (selectedPlayer.head_photo.startsWith('http')
                                            ? selectedPlayer.head_photo
                                            : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')}${selectedPlayer.head_photo}`)
                                        : '/assets/images/players/heads/default.png'}
                                    alt={selectedPlayer.firstName}
                                    className="rounded-circle mb-3 border border-3 border-warning"
                                    style={{ width: '120px', height: '120px', objectFit: 'cover' }}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.onerror = null;
                                        // Simple gray placeholder SVG as data URI
                                        target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjUwIiBmaWxsPSIjNjY2Ij4/PC90ZXh0Pjwvc3ZnPg==';
                                    }}
                                />
                                <h4>{selectedPlayer.nickname}</h4>
                                <div className="d-flex justify-content-center gap-2 mb-3">
                                    <span className="badge bg-success fs-6">{selectedPlayer.number}</span>
                                    <span className="badge bg-secondary fs-6">{selectedPlayer.position}</span>
                                    {selectedPlayer.isCaptain && <span className="badge bg-warning text-dark fs-6">קפטן</span>}
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
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPlayer(null)}>סגור</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Vote Confirmation Modal */}
            {voteConfirmPlayer && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => !isVoting && setVoteConfirmPlayer(null)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-success text-white">
                                <h5 className="modal-title">
                                    <i className={`fa-solid ${myVote?.playerMemberId === voteConfirmPlayer.memberId ? 'fa-star-half-stroke text-danger' : 'fa-star text-warning'} ms-2`}></i>
                                    אישור הצבעה
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setVoteConfirmPlayer(null)} disabled={isVoting}></button>
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
                                    className={`btn ${myVote?.playerMemberId === voteConfirmPlayer.memberId ? 'btn-danger' : 'btn-success'} px-4 fw-bold`}
                                    onClick={confirmVote}
                                    disabled={isVoting}
                                >
                                    {isVoting ? (
                                        <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> מעדכן...</>
                                    ) : (
                                        myVote?.playerMemberId === voteConfirmPlayer.memberId ? 'בטל הצבעה' : 'אשר הצבעה'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Teams;
