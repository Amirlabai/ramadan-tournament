import { useEffect, useState } from 'react';
import { statsAPI } from '../api/client';
import type { Standing, TopScorer } from '../types';
import './Stats.css';

const Stats = () => {
    const [standings, setStandings] = useState<Standing[]>([]);
    const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [standingsRes, scorersRes] = await Promise.all([
                    statsAPI.getStandings(),
                    statsAPI.getTopScorers()
                ]);
                setStandings(standingsRes.data);
                setTopScorers(scorersRes.data);
            } catch (err) {
                setError('שגיאה בטעינת סטטיסטיקות');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="loading">טוען...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="stats-page container py-4">
            <h1 className="page-title">סטטיסטיקות</h1>

            <div className="stats-grid">
                <div className="card standings-table">
                    <h2>טבלת ליגה</h2>
                    <div className="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>מיקום</th>
                                    <th>קבוצה</th>
                                    <th>משחקים</th>
                                    <th>נצחונות</th>
                                    <th>תיקו</th>
                                    <th>הפסדים</th>
                                    <th>GF</th>
                                    <th>GA</th>
                                    <th>GD</th>
                                    <th>נקודות</th>
                                </tr>
                            </thead>
                            <tbody>
                                {standings.map((team, index) => (
                                    <tr key={team.teamId} className={index < 4 ? 'qualified' : ''}>
                                        <td className="position">{index + 1}</td>
                                        <td className="team-name">{team.teamName}</td>
                                        <td>{team.played}</td>
                                        <td>{team.won}</td>
                                        <td>{team.drawn}</td>
                                        <td>{team.lost}</td>
                                        <td>{team.goalsFor}</td>
                                        <td>{team.goalsAgainst}</td>
                                        <td className={team.goalDifference > 0 ? 'positive' : team.goalDifference < 0 ? 'negative' : ''}>
                                            {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                                        </td>
                                        <td className="points">{team.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card top-scorers-list">
                    <h2>מלכי השערים</h2>
                    <div className="scorers-list">
                        {topScorers.map((scorer, index) => (
                            <div key={scorer.memberId} className="scorer-item">
                                <div className="scorer-rank">#{index + 1}</div>
                                <div className="scorer-details">
                                    <div className="scorer-name">{scorer.playerName}</div>
                                    <div className="scorer-team">{scorer.teamName}</div>
                                </div>
                                <div className="scorer-goals">
                                    <span className="goals-count">{scorer.goals}</span>
                                    <span className="goals-label">⚽</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Stats;
