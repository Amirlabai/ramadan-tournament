import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { matchesAPI, matchStatsAPI, teamsAPI } from '../api/client';
import type { Match, Team } from '../types';
import SEO from '../components/SEO';
import { ScheduleSkeleton } from '../components/skeleton';
import EmptyState from '../components/EmptyState';
import CommentSection from '../components/CommentSection';
import { MatchStatusBadge, MatchTeamsScore } from '../components/match/MatchCardParts';
import { MatchCommentsToggle } from '../components/match/MatchCommentsToggle';
import { MatchStatsSection } from '../components/match/MatchStatsSection';
import { UpcomingWinChance } from '../components/match/UpcomingWinChance';
import { MatchShareCard } from '../components/share/MatchShareCard';
import { ShareButton } from '../components/share/ShareButton';
import { resolveAssetUrl } from '../utils/assetUrl';
import { matchShareSnapshot } from '../utils/shareSnapshot';
import { trackEvent } from '../utils/analytics';
import { getMatchDisplayStatus, shouldPollTournamentData } from '@ramadan-tournament/shared';
import { useMatchStatusNow } from '../hooks/useMatchStatusNow';
import { useMinSkeletonTime } from '../hooks/useMinSkeletonTime';
import { compareMatchesByKickoff } from '../utils/compareMatchesByKickoff';
import './Schedule.css';

const Schedule = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'live' | 'finished'>('upcoming');
    const [scrollMatchId, setScrollMatchId] = useState<number | null>(null);
    const location = useLocation();

    useEffect(() => {
        const state = location.state as { filter?: typeof activeFilter; matchId?: number };
        if (state?.filter) {
            setActiveFilter(state.filter);
        }
        if (typeof state?.matchId === 'number') {
            setScrollMatchId(state.matchId);
            setExpandedMatchId(state.matchId);
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

        const target = matches.find((m) => m.id === scrollMatchId);
        if (target) {
            const status = getMatchDisplayStatus(
                target.date,
                now,
                target.technicalWinnerTeamId
            );
            if (activeFilter !== 'all' && activeFilter !== status) {
                setActiveFilter(status);
                return;
            }
        } else if (activeFilter !== 'all') {
            setActiveFilter('all');
            return;
        }

        const timer = setTimeout(() => {
            document.getElementById(`match-${scrollMatchId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
            setScrollMatchId(null);
        }, 100);
        return () => clearTimeout(timer);
    }, [showSkeleton, scrollMatchId, matches, activeFilter, now]);

    if (showSkeleton) return <ScheduleSkeleton label="טוען לוח משחקים..." />;
    if (error) return <div className="error" role="alert">{error}</div>;

    const getTeamName = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : `קבוצה ${teamId}`;
    };

    const getTeamLogo = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        if (!team || team.logoPosition === 'none') return undefined;
        return resolveAssetUrl(team.logoUrl);
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
            <SEO pathname="/schedule" />
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
                    const team1Name = getTeamName(match.team1Id);
                    const team2Name = getTeamName(match.team2Id);
                    const team1Logo = getTeamLogo(match.team1Id);
                    const team2Logo = getTeamLogo(match.team2Id);
                    const expandPanelId = `match-expand-${match.id}`;
                    return (
                        <div key={match.id} id={`match-${match.id}`} className={`match-card card ${status}${match.technicalWinnerTeamId != null ? ' technical' : ''}`}>
                            <div className="match-card-badges">
                                <MatchStatusBadge
                                    status={status}
                                    technical={match.technicalWinnerTeamId != null}
                                />
                                {match.phase === 'knockout' && (
                                    <span className="playoff-badge">פלייאוף</span>
                                )}
                            </div>

                            <MatchTeamsScore
                                team1Name={team1Name}
                                team2Name={team2Name}
                                score1={match.score1}
                                score2={match.score2}
                                showScores={status !== 'upcoming'}
                                team1OnRight
                                team1Winner={match.technicalWinnerTeamId === match.team1Id}
                                team2Winner={match.technicalWinnerTeamId === match.team2Id}
                                team1Logo={
                                    team1Logo ? (
                                        <img
                                            src={team1Logo}
                                            alt={`לוגו ${team1Name}`}
                                            className="team-logo-inline"
                                        />
                                    ) : undefined
                                }
                                team2Logo={
                                    team2Logo ? (
                                        <img
                                            src={team2Logo}
                                            alt={`לוגו ${team2Name}`}
                                            className="team-logo-inline"
                                        />
                                    ) : undefined
                                }
                            />

                            <div className="match-meta">
                                <span className="match-date">{formatDate(match.date)}</span>
                                <span className="match-location">{match.location}</span>
                            </div>

                            {status === 'upcoming' && match.technicalWinnerTeamId == null ? (
                                <UpcomingWinChance
                                    matchId={match.id}
                                    team1Name={team1Name}
                                    team2Name={team2Name}
                                />
                            ) : null}

                            <div className="match-actions">
                                <MatchCommentsToggle
                                    expanded={expandedMatchId === match.id}
                                    status={status}
                                    commentCount={match.commentCount}
                                    controlsId={expandPanelId}
                                    onClick={() => {
                                        if (expandedMatchId !== match.id) {
                                            trackEvent('match_expand', {
                                                category: 'browse',
                                                properties: {
                                                    matchId: match.id,
                                                    surface: 'schedule',
                                                },
                                            });
                                        }
                                        setExpandedMatchId(
                                            expandedMatchId === match.id ? null : match.id
                                        );
                                    }}
                                />
                                <ShareButton
                                    filename={`match-${match.id}.png`}
                                    snapshot={matchShareSnapshot(match, status, {
                                        team1Logo,
                                        team2Logo,
                                        teams,
                                    })}
                                    title={`${team1Name} נגד ${team2Name}`}
                                    text={`סיכום המשחק: ${team1Name} נגד ${team2Name}`}
                                    prepare={async () => {
                                        // Freeze face at prepare-time so capture cannot race live props.
                                        const face = {
                                            match,
                                            status,
                                            team1Name,
                                            team2Name,
                                            team1Logo,
                                            team2Logo,
                                            teams,
                                        };
                                        if (status === 'upcoming' || match.technicalWinnerTeamId != null) {
                                            return { stats: null, face };
                                        }
                                        try {
                                            return {
                                                stats: (await matchStatsAPI.get(match.id)).data,
                                                face,
                                            };
                                        } catch {
                                            return { stats: null, face };
                                        }
                                    }}
                                    renderContent={(prepared) => {
                                        if (!prepared) return null;
                                        const { stats, face } = prepared;
                                        return (
                                            <MatchShareCard
                                                match={face.match}
                                                status={face.status}
                                                team1Name={face.team1Name}
                                                team2Name={face.team2Name}
                                                team1Logo={face.team1Logo}
                                                team2Logo={face.team2Logo}
                                                teams={face.teams}
                                                stats={stats}
                                            />
                                        );
                                    }}
                                />
                            </div>

                            {expandedMatchId === match.id && (
                                <div id={expandPanelId}>
                                    {status !== 'upcoming' ? (
                                        <MatchStatsSection
                                            match={match}
                                            team1Name={team1Name}
                                            team2Name={team2Name}
                                            teams={teams}
                                            active
                                        />
                                    ) : null}
                                    <CommentSection matchId={match.id} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Schedule;
