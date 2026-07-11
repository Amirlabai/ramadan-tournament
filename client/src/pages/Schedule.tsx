import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { matchesAPI, teamsAPI } from '../api/client';
import type { Match, Team } from '../types';
import SEO from '../components/SEO';
import { ScheduleSkeleton } from '../components/skeleton';
import EmptyState from '../components/EmptyState';
import CommentSection from '../components/CommentSection';
import { resolveAssetUrl } from '../utils/assetUrl';
import { getMatchDisplayStatus, shouldPollTournamentData } from '@ramadan-tournament/shared';
import { useMatchStatusNow } from '../hooks/useMatchStatusNow';
import { useMinSkeletonTime } from '../hooks/useMinSkeletonTime';
import { MatchStatusBadge } from '../components/match/MatchCardParts';
import { compareMatchesByKickoff } from '../utils/compareMatchesByKickoff';
import './Schedule.css';

const Schedule = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'live' | 'finished'>('all');
    const [scrollMatchId, setScrollMatchId] = useState<number | null>(null);
    const location = useLocation();

    const getTeamIdByMemberId = (memberId: number) => {
        const team = teams.find(t => t.players?.some(p => p.memberId === memberId));
        return team?.id;
    };

    useEffect(() => {
        const state = location.state as { filter?: typeof activeFilter; matchId?: number };
        if (state?.filter) {
            setActiveFilter(state.filter);
        }
        if (typeof state?.matchId === 'number') {
            setScrollMatchId(state.matchId);
        }
        if (state?.filter || state?.matchId != null) {
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

    const matchesRef = useRef(matches);
    matchesRef.current = matches;
    const now = useMatchStatusNow(matches);

    useEffect(() => {
        fetchData();

        const interval = setInterval(() => {
            if (shouldPollTournamentData(matchesRef.current)) {
                fetchData(true);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const showSkeleton = useMinSkeletonTime(loading, { error });

    useEffect(() => {
        if (showSkeleton || scrollMatchId == null) return;
        const timer = setTimeout(() => {
            document.getElementById(`match-${scrollMatchId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
            setScrollMatchId(null);
        }, 100);
        return () => clearTimeout(timer);
    }, [showSkeleton, scrollMatchId]);

    if (showSkeleton) return <ScheduleSkeleton label="טוען לוח משחקים..." />;
    if (error) return <div className="error" role="alert">{error}</div>;

    const getTeamName = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : `קבוצה ${teamId}`;
    };

    const getTeamLogo = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        return resolveAssetUrl(team?.logoUrl);
    };

    const getTeamLogoPosition = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        return team?.logoPosition || 'right';
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

    const getMatchStatus = (match: Match) =>
        getMatchDisplayStatus(match.date, now, match.technicalWinnerTeamId);

    const sortedMatches = [...matches].sort(compareMatchesByKickoff);

    const filteredMatches = (() => {
        const base = activeFilter === 'all'
            ? sortedMatches
            : sortedMatches.filter(m => getMatchStatus(m) === activeFilter);
        return activeFilter === 'finished' ? [...base].reverse() : base;
    })();

    const filterOptions: { key: typeof activeFilter; label: string }[] = [
        { key: 'all', label: 'הכל' },
        { key: 'upcoming', label: 'עתיד' },
        { key: 'live', label: 'לייב' },
        { key: 'finished', label: 'הסתיים' },
    ];

    return (
        <div className="schedule-page container py-4">
            <SEO 
                title="לוח משחקים" 
                description="לוח המשחקים המלא של טורניר רמדאן 2026. עדכונים חיים, תוצאות וזמני משחקים של כל שלבי הטורניר." 
                pathname="/schedule"
            />
            <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">לוח משחקים</h2>

            <div className="schedule-filters" role="group" aria-label="סינון משחקים">
                {filterOptions.map(({ key, label }) => (
                    <button
                        type="button"
                        key={key}
                        className={`filter-btn ${activeFilter === key ? 'active' : ''} ${key !== 'all' ? key : ''}`}
                        aria-pressed={activeFilter === key}
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
                {matches.length === 0 ? (
                    <EmptyState
                        title="אין משחקים בלוח"
                        message="לוח המשחקים יפורסם לאחר רישום הקבוצות והפעלת העונה."
                    />
                ) : filteredMatches.length === 0 ? (
                    <EmptyState message="אין משחקים בסינון שנבחר. נסה קטגוריה אחרת." />
                ) : null}
                {filteredMatches.map((match) => {
                    const status = getMatchStatus(match);
                    return (
                        <div key={match.id} id={`match-${match.id}`} className={`match-card card ${status}${match.technicalWinnerTeamId != null ? ' technical' : ''}`}>
                            <MatchStatusBadge
                                status={status}
                                technical={match.technicalWinnerTeamId != null}
                            />
                            
                            {match.phase === 'knockout' && (
                                <div className="playoff-badge-floating">משחק פלייאוף</div>
                            )}

                            <div className="match-teams-score">
                                <div
                                    className={`team-side${match.technicalWinnerTeamId === match.team1Id ? ' team-side--winner' : ''}`}
                                >
                                    {getTeamLogoPosition(match.team1Id) === 'right' && getTeamLogo(match.team1Id) && (
                                        <img src={getTeamLogo(match.team1Id)!} alt={`לוגו ${getTeamName(match.team1Id)}`} className="team-logo-inline me-2" />
                                    )}
                                    <span className="team-name">{getTeamName(match.team1Id)}</span>
                                    {getTeamLogoPosition(match.team1Id) === 'left' && getTeamLogo(match.team1Id) && (
                                        <img src={getTeamLogo(match.team1Id)!} alt={`לוגו ${getTeamName(match.team1Id)}`} className="team-logo-inline ms-2" />
                                    )}
                                    {status !== 'upcoming' && (
                                        <span className="team-score">{match.score1 ?? '—'}</span>
                                    )}
                                </div>

                                <div className="vs-divider">VS</div>

                                <div
                                    className={`team-side${match.technicalWinnerTeamId === match.team2Id ? ' team-side--winner' : ''}`}
                                >
                                    {getTeamLogoPosition(match.team2Id) === 'right' && getTeamLogo(match.team2Id) && (
                                        <img src={getTeamLogo(match.team2Id)!} alt={`לוגו ${getTeamName(match.team2Id)}`} className="team-logo-inline me-2" />
                                    )}
                                    <span className="team-name">{getTeamName(match.team2Id)}</span>
                                    {getTeamLogoPosition(match.team2Id) === 'left' && getTeamLogo(match.team2Id) && (
                                        <img src={getTeamLogo(match.team2Id)!} alt={`לוגו ${getTeamName(match.team2Id)}`} className="team-logo-inline ms-2" />
                                    )}
                                    {status !== 'upcoming' && (
                                        <span className="team-score">{match.score2 ?? '—'}</span>
                                    )}
                                </div>
                            </div>

                            <div className="match-meta">
                                <span className="match-date">{formatDate(match.date)}</span>
                                <span className="match-location">{match.location}</span>
                            </div>

                            {match.goals && match.goals.length > 0 && (() => {
                                const ownGoalsByTeam: Record<number, number> = {};
                                for (const goal of match.goals) {
                                    if (!goal.isOwnGoal || goal.creditedTeamId == null) continue;
                                    ownGoalsByTeam[goal.creditedTeamId] =
                                        (ownGoalsByTeam[goal.creditedTeamId] || 0) + 1;
                                }
                                const countsByTeam = (
                                    predicate: (teamId: number | undefined) => boolean
                                ) => {
                                    const counts: Record<number, number> = {};
                                    for (const goal of match.goals) {
                                        if (goal.isOwnGoal || goal.memberId == null) continue;
                                        const teamId = getTeamIdByMemberId(goal.memberId);
                                        if (predicate(teamId)) {
                                            counts[goal.memberId] = (counts[goal.memberId] || 0) + 1;
                                        }
                                    }
                                    return Object.entries(counts);
                                };
                                const team1Goals = countsByTeam((id) => id === match.team1Id);
                                const team2Goals = countsByTeam((id) => id === match.team2Id);
                                const otherGoals = countsByTeam(
                                    (id) => id !== match.team1Id && id !== match.team2Id
                                );
                                const renderGoalItem = (memberId: string, count: number) => {
                                    const id = Number(memberId);
                                    const teamId = getTeamIdByMemberId(id);
                                    return (
                                        <Link
                                            key={memberId}
                                            to="/teams"
                                            state={{ expandTeamId: teamId }}
                                            className="goal-item text-decoration-none"
                                            onClick={(e) => {
                                                if (!teamId) e.preventDefault();
                                            }}
                                        >
                                            <span>{getPlayerNickname(id)}</span>
                                            <span>{count > 1 ? ` ⚽×${count}` : ' ⚽'}</span>
                                        </Link>
                                    );
                                };
                                const renderOwnGoals = (teamId: number) => {
                                    const n = ownGoalsByTeam[teamId] || 0;
                                    if (n === 0) return null;
                                    return (
                                        <span key={`og-${teamId}`} className="goal-item">
                                            גול עצמי{n > 1 ? ` ×${n}` : ''}
                                        </span>
                                    );
                                };
                                return (
                                    <div className="match-goals">
                                        <h4>כובשים:</h4>
                                        <div className="goals-list goals-list--sides" role="group" aria-label="כובשים לפי קבוצה">
                                            <div
                                                className="goals-side"
                                                role="group"
                                                aria-label={getTeamName(match.team1Id)}
                                            >
                                                {team1Goals.map(([memberId, count]) => renderGoalItem(memberId, count))}
                                                {renderOwnGoals(match.team1Id)}
                                            </div>
                                            <div className="goals-side-gap" aria-hidden="true" />
                                            <div
                                                className="goals-side"
                                                role="group"
                                                aria-label={getTeamName(match.team2Id)}
                                            >
                                                {team2Goals.map(([memberId, count]) => renderGoalItem(memberId, count))}
                                                {renderOwnGoals(match.team2Id)}
                                            </div>
                                        </div>
                                        {otherGoals.length > 0 && (
                                            <div
                                                className="goals-list goals-list--other"
                                                role="group"
                                                aria-label="אחר"
                                            >
                                                <span className="goals-other-label">אחר</span>
                                                {otherGoals.map(([memberId, count]) => renderGoalItem(memberId, count))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <div className="match-actions">
                                <button
                                    type="button"
                                    className="btn-comments"
                                    aria-expanded={expandedMatchId === match.id}
                                    onClick={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)}
                                >
                                    {expandedMatchId === match.id ? '🔼 הסתר תגובות' : (
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

                            {expandedMatchId === match.id && (
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
