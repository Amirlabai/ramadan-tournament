import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsAPI, votesAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardData } from '../types';
import SEO from '../components/SEO';
import './Dashboard.css'; // Reusing Dashboard styles for the widgets

const MVPs = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [mvpLeaderboard, setMvpLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hasVoted, setHasVoted] = useState<boolean | null>(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    const fetchStats = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const response = await statsAPI.getDashboard();
            setData(response.data);
            if (!isBackground) setError('');
        } catch (err) {
            if (!isBackground) setError('שגיאה בטעינת נתונים');
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    const fetchMvpLeaderboard = async () => {
        try {
            const response = await votesAPI.getResults('mvp');
            setMvpLeaderboard(response.data.leaderboard || []);
        } catch (err) {
            console.error('Error fetching MVP leaderboard:', err);
        }
    };

    const fetchMyVote = async () => {
        if (!user) {
            setHasVoted(false);
            return;
        }
        try {
            const response = await votesAPI.getMyVote('mvp');
            setHasVoted(!!response.data?.voted);
        } catch (err) {
            console.error('Error fetching vote:', err);
            setHasVoted(false); // Default to not voted on error
        }
    };

    useEffect(() => {
        fetchStats();
        fetchMvpLeaderboard();
        fetchMyVote();

        // Polling logic: Every 5 minutes
        const interval = setInterval(() => {
            fetchStats(true);
            fetchMvpLeaderboard();
        }, 300000);

        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-success" role="status"><span className="visually-hidden">טוען...</span></div></div>;
    if (error) return <div className="alert alert-danger m-3">{error}</div>;
    if (!data) return <div className="error">אין נתונים</div>;

    return (
        <div className="dashboard-page mvps-page">
            <SEO
                title="מצטיינים"
                description="מלכי השערים ומירוץ ה-MVP של טורניר נצ'מאז כפר כמא 2026."
            />
            <div className="container py-4">
                <h2 className="mb-4 fw-bold text-success border-bottom pb-2">מצטייני הטורניר</h2>

                {(!user || hasVoted === false) && (
                    <div className="alert custom-claim-banner d-flex flex-column flex-sm-row align-items-center justify-content-between mb-4 shadow-sm text-center text-sm-start" role="alert" style={{ background: 'linear-gradient(135deg, var(--secondary-yellow) 0%, #ffe285ff 100%)', color: '#000000ff', border: 'none' }}>
                        <div className="mb-2 mb-sm-0 pe-sm-4">
                            <strong>מי ה-MVP שלך? </strong>
                            <span className="ms-2">
                                {!user ? 'התחבר עכשיו ובחר את השחקן המצטיין של הטורניר!' : 'טרם בחרת שחקן מצטיין! עברו לעמוד הקבוצות ולחצו על סימון הכוכב (⭐) ליד השחקן כדי לבחור בו.'}
                            </span>
                        </div>
                        <button 
                            className="btn btn-light fw-bold px-4 shadow-sm"
                            onClick={() => navigate('/teams', { state: { showVotePrompt: true } })}
                        >
                            מעבר להצבעה
                        </button>
                    </div>
                )}

                <div className="row">
                    <div className="col-md-6 mb-4">
                        {data.topScorers && data.topScorers.length > 0 && (
                            <div className="dashboard-card top-scorer h-100 mt-0">
                                <h2>מלך השערים</h2>
                                <div className="scorer-info h-100">
                                    {/* 1st Place - Premium with Gold Aura */}
                                    <div
                                        className="premium-scorer-wrapper h-100"
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
                                                    <span className="runner-goals fw-bold text-success ms-auto ps-2">{scorer.goals}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="col-md-6 mb-4">
                        {/* MVP Race Leaderboard */}
                        {mvpLeaderboard && mvpLeaderboard.length > 0 && (
                            <div className="dashboard-card mvp-race-card h-100 mt-0">
                                <div className="card-header d-flex justify-content-between align-items-center">
                                    <h2 className="mb-0 fs-4 w-100 text-center">🏆 MVP</h2>
                                </div>
                                <div className="card-body p-0">
                                    {mvpLeaderboard.slice(0, 5).map((item, index) => (
                                        <div
                                            key={item.memberId}
                                            className={`mvp-row d-flex align-items-center justify-content-between p-3 border-bottom ${index === 0 ? 'bg-light-gold' : ''}`}
                                            onClick={() => navigate('/teams', {
                                                state: {
                                                    expandTeamId: data?.teams?.find((t: any) => t.name === item.teamName)?.id || 0,
                                                    selectPlayerId: item.memberId
                                                }
                                            })}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="d-flex align-items-center gap-3">
                                                <div className={`mvp-rank fw-bold ${index === 0 ? 'text-warning fs-4' : 'text-secondary'}`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="fw-bold fs-6">
                                                        {item.player.firstName} {item.player.lastName}
                                                        {item.player.nickname && <span className="text-muted ms-1">({item.player.nickname})</span>}
                                                    </div>
                                                    <div className="small text-muted">{item.teamName}</div>
                                                </div>
                                            </div>
                                            <div className="mvp-votes text-center">
                                                <div className="fw-bold fs-5 text-success">{item.votes}</div>
                                                <div className="small text-muted" style={{ fontSize: '0.7rem' }}>הצבעות</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MVPs;
