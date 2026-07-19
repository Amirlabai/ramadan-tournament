import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsAPI } from '../api/client';
import type { Standing, TopScorer, Match } from '../types';
import SEO from '../components/SEO';
import { StatsSkeleton } from '../components/skeleton';
import EmptyState from '../components/EmptyState';
import PlayoffBracket from '../components/PlayoffBracket';
import { STANDINGS_PLAYOFF_ZONE_SIZE, shouldPollTournamentData } from '@ramadan-tournament/shared';
import { refreshPollMatchesRef, shouldRefreshPollMatches } from '../utils/tournamentPollMatches';
import { useMinSkeletonTime } from '../hooks/useMinSkeletonTime';
import StandingsTable from '../components/standings/StandingsTable';
import { PlayerHeadImg } from '../components/PlayerHeadImg';
import { toHeadPlayer } from '../utils/toHeadPlayer';
import './Stats.css';

const Stats = () => {
    const [standings, setStandings] = useState<Standing[]>([]);
    const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
    const [playoffMatches, setPlayoffMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const pollMatchesRef = useRef<{ date: string }[]>([]);

    const fetchStats = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const [standingsRes, scorersRes, playoffsRes] = await Promise.all([
                statsAPI.getStandings(),
                statsAPI.getTopScorers(),
                statsAPI.getPlayoffs()
            ]);
            setStandings(standingsRes.data);
            setTopScorers(scorersRes.data);
            setPlayoffMatches(playoffsRes.data);
            if (!isBackground) setError('');
        } catch (err) {
            if (!isBackground) setError('שגיאה בטעינת סטטיסטיקות');
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        void refreshPollMatchesRef(pollMatchesRef);

        const interval = setInterval(() => {
            void (async () => {
                if (shouldRefreshPollMatches(pollMatchesRef.current)) {
                    await refreshPollMatchesRef(pollMatchesRef);
                }
                if (shouldPollTournamentData(pollMatchesRef.current)) {
                    fetchStats(true);
                }
            })();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const showSkeleton = useMinSkeletonTime(loading, { error });

    if (showSkeleton) return <StatsSkeleton label="טוען סטטיסטיקות..." />;
    if (error) return <div className="error" role="alert">{error}</div>;

    const hasStats = standings.length > 0 || topScorers.length > 0;
    return (
        <div className="stats-page container py-4">
            <SEO pathname="/stats" />
            <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">סטטיסטיקות</h2>

            {!hasStats ? (
                <EmptyState
                    title="אין נתונים עדיין"
                    message="טבלת הליגה ומלכי השערים יתמלאו לאחר משחקי העונה."
                />
            ) : (
            <>
            {/* Playoff Bracket */}
            {playoffMatches.length > 0 && (
                <PlayoffBracket matches={playoffMatches} />
            )}

            <div className="stats-grid">
                <StandingsTable
                    title="טבלת ליגה"
                    caption={`טבלת דירוג קבוצות הליגה. ${STANDINGS_PLAYOFF_ZONE_SIZE} המקומות הראשונים מסומנים ברקע כחול (פלייאוף עליון).`}
                    columns={[
                        {
                            id: 'rank',
                            header: 'דירוג',
                            className: 'position',
                            render: (_row, index) => index + 1,
                        },
                        {
                            id: 'team',
                            header: 'קבוצה',
                            className: 'team-name',
                            render: (team) => (
                                <button
                                    type="button"
                                    className="btn btn-link p-0 text-decoration-none team-name"
                                    onClick={() => navigate('/teams', { state: { expandTeamId: team.teamId } })}
                                >
                                    {team.teamName}
                                </button>
                            ),
                        },
                        { id: 'played', header: 'משחק', render: (team) => team.played },
                        {
                            id: 'wdl',
                            header: 'W/D/L',
                            render: (team) => `${team.won}/${team.drawn}/${team.lost}`,
                        },
                        { id: 'gf', header: 'GF', render: (team) => team.goalsFor },
                        { id: 'ga', header: 'GA', render: (team) => team.goalsAgainst },
                        {
                            id: 'gd',
                            header: 'GD',
                            className: 'gd',
                            render: (team) => (
                                <span className={team.goalDifference > 0 ? 'positive' : team.goalDifference < 0 ? 'negative' : ''}>
                                    {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                                </span>
                            ),
                        },
                        {
                            id: 'points',
                            header: 'נקודות',
                            className: 'points',
                            render: (team) => team.points,
                        },
                    ]}
                    rows={standings}
                    getRowKey={(team) => team.teamId}
                    getRowClassName={(_team, index) =>
                        index < STANDINGS_PLAYOFF_ZONE_SIZE ? 'qualified' : undefined
                    }
                />

                <div className="card top-scorers-list">
                    <h2 className="dashboard-card-title">מלכי השערים</h2>
                    <div className="scorers-list">
                        {topScorers.slice(0, 10).map((scorer, index) => (
                            <button
                                type="button"
                                key={scorer.memberId}
                                className="scorer-item w-100 border-0 text-start bg-transparent"
                                onClick={() => navigate('/teams', {
                                    state: {
                                        expandTeamId: scorer.teamId,
                                        selectPlayerId: scorer.memberId
                                    }
                                })}
                            >
                                <div className="scorer-rank">#{index + 1}</div>
                                <PlayerHeadImg
                                    player={toHeadPlayer(scorer)}
                                    alt=""
                                    className="stats-scorer-head-img"
                                />
                                <div className="scorer-details">
                                    <div className="scorer-name">{scorer.playerName}</div>
                                    <div className="scorer-team">{scorer.teamName}</div>
                                </div>
                                <div className="scorer-goals">
                                    <div className="goals-main">
                                        <span className="goals-count">{scorer.goals}</span>
                                        <span className="goals-label">שערים</span>
                                    </div>
                                    <div className="goals-avg" style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                        ממוצע: {scorer.gamesPlayed && scorer.gamesPlayed > 0
                                            ? (scorer.goals / scorer.gamesPlayed).toFixed(2)
                                            : '0.00'}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            </>
            )}
        </div>
    );
};

export default Stats;
