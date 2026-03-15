import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { matchesAPI, teamsAPI } from '../api/client';
import type { Match, Team } from '../types';
import CommentSection from '../components/CommentSection';
import './Schedule.css';

const VITE_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

const Schedule = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'live' | 'finished'>('all');
    const location = useLocation();
    const navigate = useNavigate();

    const getTeamIdByMemberId = (memberId: number) => {
        const team = teams.find(t => t.players?.some(p => p.memberId === memberId));
        return team?.id;
    };

    useEffect(() => {
        const state = location.state as { filter?: typeof activeFilter };
        if (state?.filter) {
            setActiveFilter(state.filter);
            // Clear state so it doesn't persist on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const fetchData = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const [matchesRes, teamsRes] = await Promise.all([
                matchesAPI.getAll(),
                teamsAPI.getAll()
            ]);
            setMatches(matchesRes.data);
            setTeams(teamsRes.data);
            setError('');
        } catch (err) {
            if (!isBackground) setError('שגיאה בטעינת נתונים');
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Polling logic: Every 30 seconds
        const interval = setInterval(() => {
            // Check if any match in the current data is for today
            const hasMatchToday = matches.some(match => {
                const d = new Date(match.date);
                const now = new Date();
                return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });

            // Poll during tournament hours or if match is today
            const now = new Date();
            const hour = now.getHours();
            if (hasMatchToday || (hour >= 20 && hour <= 23)) {
                fetchData(true);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [matches.length]);

    if (loading) return <div className="loading">טוען...</div>;
    if (error) return <div className="error">{error}</div>;

    const getTeamName = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : `קבוצה ${teamId}`;
    };

    const getTeamLogo = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        if (!team || !team.logoUrl) return null;
        return team.logoUrl.startsWith('http') ? team.logoUrl : `${VITE_API_URL}${team.logoUrl}`;
    };

    const getTeamLogoPosition = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        return team?.logoPosition || 'right';
    };

    const getTeamNameById = (memberId: number) => {
        const team = teams.find(t => t.players?.some(p => p.memberId === memberId));
        return team ? team.name : `${memberId}`;
    };
    const getPlayerNickname = (memberId: number) => {
        for (const team of teams) {
            const player = team.players?.find(p => p.memberId === memberId);
            if (player) {
                return `${player.nickname}(${player.number})`;
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
            weekday: 'long',
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

    const filteredMatches = (() => {
        const base = activeFilter === 'all'
            ? sortedMatches
            : sortedMatches.filter(m => getMatchStatus(m) === activeFilter);
        return activeFilter === 'finished' ? [...base].reverse() : base;
    })();

    const filterOptions: { key: typeof activeFilter; label: string }[] = [
        { key: 'all', label: 'הכל' },
        { key: 'upcoming', label: 'עתיד' },
        { key: 'live', label: 'Live' },
        { key: 'finished', label: 'הסתיים' },
    ];

    return (
        <div className="schedule-page container py-4">
            <h2 className="mb-4 fw-bold text-success border-bottom pb-2">לוח משחקים</h2>

            <div className="schedule-filters">
                {filterOptions.map(({ key, label }) => (
                    <button
                        key={key}
                        className={`filter-btn ${activeFilter === key ? 'active' : ''} ${key !== 'all' ? key : ''}`}
                        onClick={() => setActiveFilter(key)}
                    >
                        {label}
                        {key !== 'all' && (
                            <span className="filter-count">
                                {sortedMatches.filter(m => getMatchStatus(m) === key).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="matches-list">
                {filteredMatches.map((match) => {
                    const status = getMatchStatus(match);
                    return (
                        <div key={match._id} className={`match-card card ${status}`}>
                            <span className={`match-status ${status}`}>
                                {status === 'upcoming' ? 'עתיד' : status === 'live' ? 'Live' : 'הסתיים'}
                            </span>
                            
                            {match.phase === 'knockout' && (
                                <div className="playoff-badge-floating">משחק פלייאוף</div>
                            )}

                            <div className="match-teams-score">
                                <div className="team-side">
                                    {getTeamLogoPosition(match.team1Id) === 'right' && getTeamLogo(match.team1Id) && (
                                        <img src={getTeamLogo(match.team1Id)!} alt="logo" className="team-logo-inline me-2" />
                                    )}
                                    <span className="team-name">{getTeamName(match.team1Id)}</span>
                                    {getTeamLogoPosition(match.team1Id) === 'left' && getTeamLogo(match.team1Id) && (
                                        <img src={getTeamLogo(match.team1Id)!} alt="logo" className="team-logo-inline ms-2" />
                                    )}
                                    {status !== 'upcoming' && (
                                        <span className="team-score">{match.score1}</span>
                                    )}
                                </div>

                                <div className="vs-divider">VS</div>

                                <div className="team-side">
                                    {getTeamLogoPosition(match.team2Id) === 'right' && getTeamLogo(match.team2Id) && (
                                        <img src={getTeamLogo(match.team2Id)!} alt="logo" className="team-logo-inline me-2" />
                                    )}
                                    <span className="team-name">{getTeamName(match.team2Id)}</span>
                                    {getTeamLogoPosition(match.team2Id) === 'left' && getTeamLogo(match.team2Id) && (
                                        <img src={getTeamLogo(match.team2Id)!} alt="logo" className="team-logo-inline ms-2" />
                                    )}
                                    {status !== 'upcoming' && (
                                        <span className="team-score">{match.score2}</span>
                                    )}
                                </div>
                            </div>

                            <div className="match-meta">
                                <span className="match-date">{formatDate(match.date)}</span>
                                <span className="match-location">{match.location}</span>
                            </div>

                            {match.goals && match.goals.length > 0 && (() => {
                                const goalCounts = match.goals.reduce<Record<number, number>>((acc, goal) => {
                                    acc[goal.memberId] = (acc[goal.memberId] || 0) + 1;
                                    return acc;
                                }, {});
                                return (
                                    <div className="match-goals">
                                        <h4>כובשים:</h4>
                                        <div className="goals-list">
                                            {Object.entries(goalCounts).map(([memberId, count]) => (
                                                <span
                                                    key={memberId}
                                                    className="goal-item"
                                                    onClick={() => {
                                                        const teamId = getTeamIdByMemberId(Number(memberId));
                                                        if (teamId) {
                                                            navigate('/teams', { state: { expandTeamId: teamId } });
                                                        }
                                                    }}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <center>{getPlayerNickname(Number(memberId))}<br />
                                                        {count > 1 ? `⚽${count}` : '⚽'} <br />
                                                        {getTeamNameById(Number(memberId))}</center>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

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
                    );
                })}
            </div>
        </div>
    );
};

export default Schedule;
