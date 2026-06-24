import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardData } from '../types';
import SEO from '../components/SEO';
import PageLoading from '../components/PageLoading';
import EmptyState from '../components/EmptyState';
import CommentSection from '../components/CommentSection';
import PlayerClaimModal from '../components/PlayerClaimModal';
import PlayoffBracket from '../components/PlayoffBracket';
import { resolveAssetUrl } from '../utils/assetUrl';
import './Dashboard.css';

const Dashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [hideClaimBanner, setHideClaimBanner] = useState(() => {
        return localStorage.getItem('hideClaimBanner') === 'true';
    });

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

            const now = new Date();
            const hour = now.getHours();
            if (hasMatchToday && hour >= 20 && hour <= 23) {
                fetchDashboard(true);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [data?.nextMatches?.length]);

    if (loading) return <PageLoading label="טוען לוח בקרה..." />;
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
    const needsPlayerMapping = user && user.role === 'User' && (!user.mappedPlayerInfo || user.mappedPlayerInfo.status === 'rejected') && !hideClaimBanner;
    const isPendingApproval = user && user.mappedPlayerInfo?.status === 'pending';

    const hasPlayoffs = !!(data.playoffMatches && data.playoffMatches.length > 0);
    const hasNextMatches = !!(data.nextMatches && data.nextMatches.length > 0);
    const hasRecentMatches = !!(data.recentMatches && data.recentMatches.length > 0);
    const hasDashboardContent = hasPlayoffs || hasNextMatches || hasRecentMatches;

    const handleDismissClaimBanner = () => {
        localStorage.setItem('hideClaimBanner', 'true');
        setHideClaimBanner(true);
    };

    const renderTeamNameWithLogo = (teamName: string, logoUrl?: string, logoPosition?: string) => {
        const logo = resolveAssetUrl(logoUrl);
        const position = logoPosition || 'right';

        if (!logo || position === 'none') return <span className="team-name">{teamName}</span>;

        return (
            <div className={`d-flex align-items-center gap-2 ${position === 'left' ? 'flex-row-reverse' : ''}`}>
                <span className="team-name">{teamName}</span>
                <img className="team-logo-inline" src={logo} alt={`לוגו ${teamName}`} style={{ height: '24px', width: '24px', objectFit: 'contain' }} />
            </div>
        );
    };

    return (
        <div className="dashboard-page">
            <SEO 
                title="דף הבית" 
                description="עקבו אחרי טורניר הרמדאן בזמן אמת - תוצאות, טבלאות, סטטיסטיקות שחקנים וחדשות החוץ והבית של טורניר נצ'מאז כפר כמא 2026." 
            />
            <div className="container py-4">

                {needsPlayerMapping && (
                    <div className="alert custom-claim-banner alert-dismissible d-flex flex-column flex-sm-row align-items-center justify-content-between mb-4 shadow-sm text-center text-sm-start" role="alert">
                        <div className="mb-2 mb-sm-0 pe-sm-4">
                            <strong>שחקן בטורניר? </strong>
                            <span className="ms-2">שייך את המשתמש שלך לפרופיל השחקן כדי לצפות בסטטיסטיקות אישיות.</span>
                        </div>
                        <button className="btn btn-warning btn-sm fw-bold px-4 rounded-pill" onClick={() => setShowClaimModal(true)}>
                            לשיוך השחקן
                        </button>
                        <button 
                            type="button" 
                            className="btn-close" 
                            onClick={handleDismissClaimBanner}
                            aria-label="סגור"
                            title="הסתר"
                        ></button>
                    </div>
                )}

                {isPendingApproval && (
                    <div className="alert alert-info d-flex align-items-center mb-4 shadow-sm border-0" role="alert" style={{ backgroundColor: 'rgba(13, 202, 240, 0.15)', color: '#055160' }}>
                        <i className="bi bi-hourglass-split me-2 fs-5" aria-hidden="true"></i>
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

                {!hasDashboardContent && (
                    <EmptyState
                        title="אין תוכן להצגה עדיין"
                        message="משחקים קרובים, תוצאות אחרונות ופלייאוף יופיעו כאן לאחר רישום הקבוצות, פרסום לוח המשחקים והתחלת העונה."
                    />
                )}

                {/* Playoff Bracket */}
                {data.playoffMatches && data.playoffMatches.length > 0 && (
                    <PlayoffBracket matches={data.playoffMatches} />
                )}

                {data.nextMatches && data.nextMatches.length > 0 && (
                    <div className="dashboard-card next-matches-card">
                        <h2 className="dashboard-card-title">המשחקים הבאים</h2>
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
                                            type="button"
                                            className="btn-comments"
                                            aria-expanded={expandedMatchId === match._id}
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


                <div className="dashboard-cards-row">
                {data.recentMatches && data.recentMatches.length > 0 && (
                    <div className="dashboard-card recent-matches">
                        <h2 className="dashboard-card-title">משחקים אחרונים</h2>
                        <div className="matches-list">
                            {data.recentMatches.slice(0, 5).map((match) => (
                                <button
                                    type="button"
                                    key={match._id}
                                    className="match-item w-100 border-0 text-start bg-transparent"
                                    onClick={() => navigate('/schedule', { state: { filter: 'finished' } })}
                                >
                                    <span className="match-date">
                                        {formatDate(match.date)}
                                        {match.phase === 'knockout' && <span className="playoff-tag-mini ms-2">פלייאוף</span>}
                                    </span>
                                    <div className="match-score">
                                        <div className="team-home">
                                            {renderTeamNameWithLogo(match.team1Name || `קבוצה ${match.team1Id}`, match.team1LogoUrl, match.team1LogoPosition)}
                                        </div>
                                        <span className="score">{match.score1} - {match.score2}</span>
                                        <div className="team-away">
                                            {renderTeamNameWithLogo(match.team2Name || `קבוצה ${match.team2Id}`, match.team2LogoUrl, match.team2LogoPosition)}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                </div>
            </div>

            {showClaimModal && <PlayerClaimModal onClose={() => setShowClaimModal(false)} />}
        </div>
    );
};

export default Dashboard;
