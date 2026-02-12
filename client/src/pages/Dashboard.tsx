import { useEffect, useState } from 'react';
import { statsAPI } from '../api/client';
import type { DashboardData } from '../types';
import './Dashboard.css';

const Dashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
        return new Date(dateString).toLocaleDateString('he-IL');
    };

    return (
        <div className="dashboard-page">
            <h1 className="page-title text-center my-4">דשבורד טורניר</h1>

            {data.latestNews && (
                <div className={`news-banner ${data.latestNews.priority === 'high' ? 'high-priority' : ''}`}>
                    <div className="container">
                        <div className="news-content">
                            <h3>{data.latestNews.title}</h3>
                            <p>{data.latestNews.message}</p>
                            <span className="news-date">{formatDate(data.latestNews.date)}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="container">
                <div className="dashboard-grid">
                    {data.nextMatch && (
                        <div className="dashboard-card next-match">
                            <h2>המשחק הבא</h2>
                            <div className="match-details">
                                <div className="match-date">{formatDate(data.nextMatch.date)}</div>
                                <div className="match-location">📍 {data.nextMatch.location}</div>
                                <div className="match-teams">
                                    <span className="team">קבוצה {data.nextMatch.team1Id}</span>
                                    <span className="vs">נגד</span>
                                    <span className="team">קבוצה {data.nextMatch.team2Id}</span>
                                </div>
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
                                    ⚽ {data.topScorer.goals} שערים
                                </div>
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
                                        <span>קבוצה {match.team1Id}</span>
                                        <span className="score">{match.score1} - {match.score2}</span>
                                        <span>קבוצה {match.team2Id}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
