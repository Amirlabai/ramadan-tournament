import { useEffect, useState } from 'react';
import { statsAPI } from '../api/client';
import type { DashboardData } from '../types';
import CommentSection from '../components/CommentSection';
import './Dashboard.css';

const Dashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const response = await statsAPI.getDashboard();
                setData(response.data);
            } catch (err) {
                setError('שגיאה בטעינת נתונים');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (loading) return <div className="loading">טוען...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="error">אין נתונים</div>;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('he-IL', {
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

    return (
        <div className="dashboard-page">
            <div className="container py-4">
                <h2 className="mb-4 fw-bold text-success border-bottom pb-2">דף הבית</h2>
                <div className="dashboard-grid">
                    {data.nextMatches && data.nextMatches.length > 0 && (
                        <div className="dashboard-card next-matches-card">
                            <h2>המשחקים הבאים</h2>
                            <div className="next-matches-list">
                                {data.nextMatches.map((match) => (
                                    <div key={match._id} className="upcoming-match-item">
                                        <div className="team-right">
                                            <span className="team-name">{match.team1Name || `קבוצה ${match.team1Id}`}</span>
                                        </div>
                                        <div className="match-vs">
                                            <span className="vs-badge">נגד</span>
                                        </div>
                                        <div className="team-left">
                                            <span className="team-name">{match.team2Name || `קבוצה ${match.team2Id}`}</span>
                                        </div>
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
                </div>


                {data.recentMatches && data.recentMatches.length > 0 && (
                    <div className="dashboard-card recent-matches mt-4">
                        <h2>משחקים אחרונים</h2>
                        <div className="matches-list">
                            {data.recentMatches.slice(0, 5).map((match) => (
                                <div key={match._id} className="match-item">
                                    <span className="match-date">{formatDate(match.date)}</span>
                                    <div className="match-score">
                                        <span>{match.team1Name || `קבוצה ${match.team1Id}`}</span>
                                        <span className="score">{match.score1} - {match.score2}</span>
                                        <span>{match.team2Name || `קבוצה ${match.team2Id}`}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {data.topScorer && (
                    <div className="dashboard-card top-scorer">
                        <h2>מלך השערים</h2>
                        <div className="scorer-info">
                            <div className="scorer-name">{data.topScorer.playerName}</div>
                            <div className="scorer-team">{data.topScorer.teamName}</div>
                            <div className="scorer-goals">
                                <span className="goals-count">{data.topScorer.goals}</span>
                                <span className="goals-label">שערים</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
