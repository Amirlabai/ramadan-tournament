import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardData } from '../types';
import CommentSection from '../components/CommentSection';
import PlayerClaimModal from '../components/PlayerClaimModal';
import PlayoffBracket from '../components/PlayoffBracket';
import './Dashboard.css';

const VITE_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

const Dashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
    const [showClaimModal, setShowClaimModal] = useState(false);

    const { user } = useAuth();
    const navigate = useNavigate();

    const fetchDashboard = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const response = await statsAPI.getDashboard();
            setData(response.data);
            setError('');
        } catch (err) {
            if (!isBackground) setError('שגיאה בטעינת נתונים');
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();

        // Polling logic: Every 30 seconds
        const interval = setInterval(() => {
            // Check if we have data and if any next match is today
            const hasMatchToday = data?.nextMatches?.some(match => {
                const d = new Date(match.date);
                const now = new Date();
                return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });

            // Always poll during typical tournament hours (e.g., 18:00 - 23:59 JLM) or if match is today
            const now = new Date();
            const hour = now.getHours();
            if (hasMatchToday || (hour >= 20 && hour <= 23)) {
                fetchDashboard(true);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [data?.nextMatches?.length]);

    if (loading) return <div className="loading">טוען...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="error">אין נתונים</div>;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('he-IL', {
            weekday: 'short',
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Jerusalem'
        }).format(date);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jerusalem'
        }).format(date);
    };

    // Show banner if User is logged in, has the 'User' role, and hasn't submitted a mapping request yet (or was rejected)
    const needsPlayerMapping = user && user.role === 'User' && (!user.mappedPlayerInfo || user.mappedPlayerInfo.status === 'rejected');
    const isPendingApproval = user && user.mappedPlayerInfo?.status === 'pending';

    const renderTeamNameWithLogo = (teamName: string, logoUrl?: string, logoPosition?: string) => {
        const logo = logoUrl ? (logoUrl.startsWith('http') ? logoUrl : `${VITE_API_URL}${logoUrl}`) : null;
        const position = logoPosition || 'right';

        if (!logo || position === 'none') return <span className="team-name">{teamName}</span>;

        return (
            <div className={`d-flex align-items-center gap-2 ${position === 'left' ? 'flex-row-reverse' : ''}`}>
                <span className="team-name">{teamName}</span>
                <img className="team-logo-inline" src={logo} alt="" style={{ height: '24px', width: '24px', objectFit: 'contain' }} />
            </div>
        );
    };

    return (
        <div className="dashboard-page">
            <div className="container py-4">

                {needsPlayerMapping && (
                    <div className="alert custom-claim-banner d-flex align-items-center justify-content-between mb-4 shadow-sm" role="alert">
                        <div>
                            <strong>שחקן בטורניר? </strong>
                            <span className="ms-2">שייך את המשתמש שלך לפרופיל השחקן כדי לצפות בסטטיסטיקות אישיות.</span>
                        </div>
                        <button className="btn btn-warning btn-sm fw-bold px-4 rounded-pill" onClick={() => setShowClaimModal(true)}>
                            לשיוך השחקן
                        </button>
                    </div>
                )}

                {isPendingApproval && (
                    <div className="alert alert-info d-flex align-items-center mb-4 shadow-sm border-0" role="alert" style={{ backgroundColor: 'rgba(13, 202, 240, 0.1)', color: '#0dcaf0' }}>
                        <i className="bi bi-hourglass-split me-2 fs-5"></i>
                        <div>
                            <strong>בקשת שיוך ממתינה לאישור קפטן</strong>
                            <div className="small opacity-75">
                                קבוצת {user.mappedPlayerInfo?.teamName || `#${user.mappedPlayerInfo?.teamId}`},
                                {user.mappedPlayerInfo?.playerName ? ` השחקן ${user.mappedPlayerInfo.playerName}` : ` שחקן מזהה #${user.mappedPlayerInfo?.memberId}`}
                            </div>
                        </div>
                    </div>
                )}

                <h2 className="mb-4 fw-bold text-success border-bottom pb-2">דף הבית</h2>

                {/* Playoff Bracket */}
                {data.playoffMatches && data.playoffMatches.length > 0 && (
                    <PlayoffBracket matches={data.playoffMatches} />
                )}

                {data.nextMatches && data.nextMatches.length > 0 && (
                    <div className="dashboard-card next-matches-card">
                        <h2>המשחקים הבאים</h2>
                        <div className="next-matches-list">
                            {data.nextMatches.map((match) => (
                                <div key={match._id} className="upcoming-match-item">
                                    <div className="match-main-info">
                                        <div className="team-right">
                                            {renderTeamNameWithLogo(match.team1Name || `קבוצה ${match.team1Id}`, match.team1LogoUrl, match.team1LogoPosition)}
                                        </div>
                                        <div className="match-vs">
                                            <span className="vs-badge">נגד</span>
                                        </div>
                                        <div className="team-left">
                                            {renderTeamNameWithLogo(match.team2Name || `קבוצה ${match.team2Id}`, match.team2LogoUrl, match.team2LogoPosition)}
                                        </div>
                                    </div>
                                    {match.phase === 'knockout' && (
                                        <div className="playoff-indicator-badge">משחק פלייאוף</div>
                                    )}
                                    <div className="match-meta" style={{ textAlign: 'right', direction: 'rtl' }}>
                                        <div><strong>תאריך:</strong> {formatDate(match.date)}</div>
                                        <div><strong>שעה:</strong> {formatTime(match.date)}</div>
                                        <div><strong>מיקום:</strong> {match.location}</div>
                                    </div>
                                    <div className="match-actions">
                                        <button
                                            className="btn-comments"
                                            onClick={() => setExpandedMatchId(expandedMatchId === match._id ? null : match._id)}
                                        >
                                            {expandedMatchId === match._id ? '🔼 הסתר תגובות' : (
                                                <>
                                                    💬 תגובות
                                                    {match.commentCount && match.commentCount > 0 ? (
                                                        <span className="badge bg-danger ms-2 rounded-pill">
                                                            {match.commentCount}
                                                        </span>
                                                    ) : null}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    {expandedMatchId === match._id && (
                                        <CommentSection matchId={match.id} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}


                {data.recentMatches && data.recentMatches.length > 0 && (
                    <div className="dashboard-card recent-matches mt-4">
                        <h2>משחקים אחרונים</h2>
                        <div className="matches-list">
                            {data.recentMatches.slice(0, 5).map((match) => (
                                <div
                                    key={match._id}
                                    className="match-item"
                                    onClick={() => navigate('/schedule', { state: { filter: 'finished' } })}
                                >
                                    <span className="match-date">
                                        {formatDate(match.date)}
                                        {match.phase === 'knockout' && <span className="playoff-tag-mini ms-2">פלייאוף</span>}
                                    </span>
                                    <div className="match-score">
                                        <div className="flex-1 d-flex justify-content-end">
                                            {renderTeamNameWithLogo(match.team1Name || `קבוצה ${match.team1Id}`, match.team1LogoUrl, match.team1LogoPosition)}
                                        </div>
                                        <span className="score px-3">{match.score1} - {match.score2}</span>
                                        <div className="flex-1 d-flex justify-content-start">
                                            {renderTeamNameWithLogo(match.team2Name || `קבוצה ${match.team2Id}`, match.team2LogoUrl, match.team2LogoPosition)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {data.topScorers && data.topScorers.length > 0 && (
                    <div className="dashboard-card top-scorer">
                        <h2>מלך השערים</h2>
                        <div className="scorer-info">
                            {/* 1st Place - Premium with Gold Aura */}
                            <div
                                className="premium-scorer-wrapper"
                                style={{ cursor: 'pointer' }}
                                onClick={() => navigate('/teams', {
                                    state: {
                                        expandTeamId: data.topScorers[0].teamId,
                                        selectPlayerId: data.topScorers[0].memberId
                                    }
                                })}
                            >
                                <div className="premium-decorations">
                                    <span className="star-decoration star-1">★</span>
                                    <span className="star-decoration star-2">★</span>
                                    <span className="star-decoration star-3">★</span>
                                </div>
                                <div className="scorer-name">{data.topScorers[0].playerName}</div>
                                <div className="scorer-team">{data.topScorers[0].teamName}</div>
                                <div className="scorer-goals">
                                    <span className="goals-count">{data.topScorers[0].goals}</span>
                                    <span className="goals-label">שערים</span>
                                </div>
                            </div>

                            {/* 2nd and 3rd Place - Simple Table-like Rows */}
                            {data.topScorers.length > 1 && (
                                <div className="runners-up-list">
                                    {data.topScorers.slice(1, 3).map((scorer, index) => (
                                        <div
                                            key={scorer.memberId}
                                            className="runner-up-item"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => navigate('/teams', {
                                                state: {
                                                    expandTeamId: scorer.teamId,
                                                    selectPlayerId: scorer.memberId
                                                }
                                            })}
                                        >
                                            <span className="runner-rank">{index + 2}.</span>
                                            <span className="runner-name">{scorer.playerName}</span>
                                            <span className="runner-team">({scorer.teamName})</span>
                                            <span className="runner-goals">{scorer.goals}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {showClaimModal && <PlayerClaimModal onClose={() => setShowClaimModal(false)} />}
        </div>
    );
};

export default Dashboard;
