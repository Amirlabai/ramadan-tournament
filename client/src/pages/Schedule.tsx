import { useEffect, useState } from 'react';
import { matchesAPI, teamsAPI } from '../api/client';
import type { Match, Team } from '../types';
import CommentSection from '../components/CommentSection';
import './Schedule.css';

const Schedule = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [matchesRes, teamsRes] = await Promise.all([
                    matchesAPI.getAll(),
                    teamsAPI.getAll()
                ]);
                setMatches(matchesRes.data);
                setTeams(teamsRes.data);
            } catch (err) {
                setError('שגיאה בטעינת נתונים');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="loading">טוען...</div>;
    if (error) return <div className="error">{error}</div>;

    const getTeamName = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : `קבוצה ${teamId}`;
    };

    const getPlayerNickname = (memberId: number) => {
        for (const team of teams) {
            const player = team.players?.find(p => p.memberId === memberId);
            if (player) {
                return player.nickname;
            }
        }
        return '';
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('he-IL', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jerusalem'
        }).format(date);
    };

    const getMatchStatus = (match: Match) => {
        if (match.score1 != null && match.score2 != null) return 'finished';

        const matchDate = new Date(match.date);
        const now = new Date();

        // Get "Wall Clock" time for both in Jerusalem
        const options: Intl.DateTimeFormatOptions = {
            timeZone: 'Asia/Jerusalem',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            hour12: false
        };

        const jlmFormatter = new Intl.DateTimeFormat('en-US', options);

        const matchParts = jlmFormatter.formatToParts(matchDate);
        const nowParts = jlmFormatter.formatToParts(now);

        const getPart = (parts: Intl.DateTimeFormatPart[], type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

        const matchY = getPart(matchParts, 'year');
        const matchM = getPart(matchParts, 'month');
        const matchD = getPart(matchParts, 'day');

        const nowY = getPart(nowParts, 'year');
        const nowM = getPart(nowParts, 'month');
        const nowD = getPart(nowParts, 'day');
        const nowH = getPart(nowParts, 'hour');

        // Compare dates (YMD)
        if (matchY < nowY) return 'finished';
        if (matchY > nowY) return 'upcoming';

        if (matchM < nowM) return 'finished';
        if (matchM > nowM) return 'upcoming';

        if (matchD < nowD) return 'finished';
        if (matchD > nowD) return 'upcoming';

        // Same day
        // Live if it's 20:00 or later (JLM time)
        if (nowH >= 20) return 'live';

        return 'upcoming';
    };

    const sortedMatches = [...matches].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return (
        <div className="schedule-page container py-4">
            <h2 className="mb-4 fw-bold text-success border-bottom pb-2">לוח משחקים</h2>
            <div className="matches-list">
                {sortedMatches.map((match) => {
                    const status = getMatchStatus(match);
                    return (
                        <div key={match._id} className={`match-card card ${status}`}>
                            <span className={`match-status ${status}`}>
                                {status === 'upcoming' ? 'עתיד' : status === 'live' ? 'Live' : 'הסתיים'}
                            </span>

                            <div className="match-teams-score">
                                <div className="team-side">
                                    <span className="team-name">{getTeamName(match.team1Id)}</span>
                                    {status !== 'upcoming' && (
                                        <span className="team-score">{match.score1}</span>
                                    )}
                                </div>

                                <div className="vs-divider">VS</div>

                                <div className="team-side">
                                    <span className="team-name">{getTeamName(match.team2Id)}</span>
                                    {status !== 'upcoming' && (
                                        <span className="team-score">{match.score2}</span>
                                    )}
                                </div>
                            </div>

                            <div className="match-meta">
                                <span className="match-date">{formatDate(match.date)}</span>
                                <span className="match-location">{match.location}</span>
                            </div>

                            {match.goals && match.goals.length > 0 && (
                                <div className="match-goals">
                                    <h4>כובשים:</h4>
                                    <div className="goals-list">
                                        {match.goals.map((goal, idx) => (
                                            <span key={idx} className="goal-item">
                                                {getPlayerNickname(goal.memberId)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="match-actions">
                                <button
                                    className="btn-comments"
                                    onClick={() => setExpandedMatchId(expandedMatchId === match._id ? null : match._id)}
                                >
                                    {expandedMatchId === match._id ? '🔼 הסתר תגובות' : '💬 תגובות'}
                                </button>
                            </div>

                            {expandedMatchId === match._id && (
                                <CommentSection matchId={match.id} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Schedule;
