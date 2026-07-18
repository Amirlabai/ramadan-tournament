import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { matchStatsAPI, statsAPI, type MatchStatsSidePair } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTournament } from '../contexts/TournamentContext';
import { useHasClaimablePlayers } from '../hooks/useHasClaimablePlayers';
import { useMatchStatusNow } from '../hooks/useMatchStatusNow';
import { getProfileTournamentBadge, needsIdentitySubmission } from '../utils/tournamentUser';
import type { DashboardData, Match } from '../types';
import SEO from '../components/SEO';
import { DashboardSkeleton } from '../components/skeleton';
import EmptyState from '../components/EmptyState';
import CommentSection from '../components/CommentSection';
import PlayerClaimModal from '../components/PlayerClaimModal';
import PlayoffBracket from '../components/PlayoffBracket';
import { MatchStatusBadge, MatchTeamsScore } from '../components/match/MatchCardParts';
import { MatchCommentsToggle } from '../components/match/MatchCommentsToggle';
import { MatchStatsSection } from '../components/match/MatchStatsSection';
import { UpcomingWinChance } from '../components/match/UpcomingWinChance';
import { PlayerHeadImg } from '../components/PlayerHeadImg';
import {
    MatchListShareCard,
    type MatchListWinChances,
} from '../components/share/MatchListShareCard';
import { ShareButton } from '../components/share/ShareButton';
import { TopScorersShareCard } from '../components/share/TopScorersShareCard';
import { resolveAssetUrl } from '../utils/assetUrl';
import { enqueueMatchStatsFetch } from '../utils/matchStatsFetchQueue';
import {
    recentMatchesShareSnapshot,
    topScorersShareSnapshot,
    upcomingMatchesShareSnapshot,
} from '../utils/shareSnapshot';
import { toHeadPlayer } from '../utils/toHeadPlayer';
import { trackEvent } from '../utils/analytics';
import { shouldPollTournamentData, getMatchDisplayStatus } from '@ramadan-tournament/shared';
import { useMinSkeletonTime } from '../hooks/useMinSkeletonTime';
import { compareMatchesByKickoff } from '../utils/compareMatchesByKickoff';
import './Dashboard.css';

const Dashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [hideClaimBanner, setHideClaimBanner] = useState(() => {
        return localStorage.getItem('hideClaimBanner') === 'true';
    });
    const dataRef = useRef(data);
    dataRef.current = data;

    const { user } = useAuth();
    const { slug } = useTournament();
    const { hasClaimablePlayers } = useHasClaimablePlayers(slug);
    const navigate = useNavigate();

    const statusMatches = [
        ...(data?.nextMatches ?? []),
        ...(data?.recentMatches ?? []),
    ];
    const now = useMatchStatusNow(statusMatches);

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

        const interval = setInterval(() => {
            const current = dataRef.current;
            const pollMatches = [
                ...(current?.nextMatches ?? []),
                ...(current?.recentMatches ?? []),
            ];
            if (shouldPollTournamentData(pollMatches)) {
                fetchDashboard(true);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const showSkeleton = useMinSkeletonTime(loading, { error });

    if (showSkeleton) return <DashboardSkeleton label="טוען לוח בקרה..." />;
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

    const formatMatchDateTime = (dateString: string) => {
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

    // Show banner if user needs mapping and claimable roster slots still exist
    const userNeedsClaim =
        user &&
        !getProfileTournamentBadge(user) &&
        (!user.mappedPlayerInfo || user.mappedPlayerInfo.status === 'rejected') &&
        !hideClaimBanner;
    const needsPlayerMapping = userNeedsClaim && hasClaimablePlayers === true;
    const isPendingApproval = user && user.mappedPlayerInfo?.status === 'pending';

    const liveMatches = (data.nextMatches ?? [])
        .filter((match) => getMatchDisplayStatus(match.date, now, match.technicalWinnerTeamId) === 'live')
        .sort(compareMatchesByKickoff);
    const upcomingMatches = (data.nextMatches ?? [])
        .filter((match) => getMatchDisplayStatus(match.date, now, match.technicalWinnerTeamId) === 'upcoming')
        .sort(compareMatchesByKickoff);
    const hasPlayoffs = !!(data.playoffMatches && data.playoffMatches.length > 0);
    const hasLiveMatches = liveMatches.length > 0;
    const hasNextMatches = upcomingMatches.length > 0;
    const playedRecentMatches = (data.recentMatches ?? []).filter(
        (match) => getMatchDisplayStatus(match.date, now, match.technicalWinnerTeamId) === 'finished'
    );
    const hasRecentMatches = playedRecentMatches.length > 0;
    const topScorers = data.topScorers ?? [];
    const hasTopScorers = topScorers.length > 0;
    const hasDashboardContent =
        hasPlayoffs || hasLiveMatches || hasNextMatches || hasRecentMatches || hasTopScorers;

    const goToPlayer = (teamId: number, memberId: number) => {
        navigate('/teams', { state: { expandTeamId: teamId, selectPlayerId: memberId } });
    };

    const handleDismissClaimBanner = () => {
        trackEvent('claim_banner_dismiss', { category: 'interaction' });
        localStorage.setItem('hideClaimBanner', 'true');
        setHideClaimBanner(true);
    };

    const handleClaimClick = () => {
        trackEvent('claim_banner_click', { category: 'interaction', properties: { division: slug } });
        if (
            (slug === 'boys' || slug === 'girls') &&
            needsIdentitySubmission(user, slug)
        ) {
            navigate('/profile', { state: { focusIdentity: slug } });
            return;
        }
        setShowClaimModal(true);
    };

    const prepareUpcomingShare = async () => {
        const matches = upcomingMatches;
        const entries = await Promise.all(
            matches.map(async (match) => {
                if (match.technicalWinnerTeamId != null) {
                    return [match.id, null] as const;
                }
                try {
                    const chance: MatchStatsSidePair | null =
                        (
                            await enqueueMatchStatsFetch(() => matchStatsAPI.get(match.id))
                        ).data.winChance ?? null;
                    return [match.id, chance] as const;
                } catch {
                    return [match.id, null] as const;
                }
            })
        );
        return {
            matches,
            winChances: Object.fromEntries(entries) as MatchListWinChances,
        };
    };

    const renderMatchCard = (match: Match) => {
        const status = getMatchDisplayStatus(match.date, now, match.technicalWinnerTeamId);
        const team1Name = match.team1Name || `קבוצה ${match.team1Id}`;
        const team2Name = match.team2Name || `קבוצה ${match.team2Id}`;
        const team1Logo =
            match.team1LogoPosition === 'none' ? undefined : resolveAssetUrl(match.team1LogoUrl);
        const team2Logo =
            match.team2LogoPosition === 'none' ? undefined : resolveAssetUrl(match.team2LogoUrl);
        const isLive = status === 'live';
        const isTechnical = match.technicalWinnerTeamId != null;
        const expandPanelId = `match-expand-${match.id}`;

        const cardBody = (
            <>
                <MatchStatusBadge status={status} technical={isTechnical} />

                {match.phase === 'knockout' && (
                    <div className="playoff-badge-floating">משחק פלייאוף</div>
                )}

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
                            <img src={team1Logo} alt={`לוגו ${team1Name}`} className="team-logo-inline" />
                        ) : undefined
                    }
                    team2Logo={
                        team2Logo ? (
                            <img src={team2Logo} alt={`לוגו ${team2Name}`} className="team-logo-inline" />
                        ) : undefined
                    }
                />

                <div className="match-meta">
                    <span className="match-date">{formatMatchDateTime(match.date)}</span>
                    <span className="match-location">{match.location}</span>
                </div>

                {status === 'upcoming' && !isTechnical ? (
                    <UpcomingWinChance
                        matchId={match.id}
                        team1Name={team1Name}
                        team2Name={team2Name}
                    />
                ) : null}
            </>
        );

        const isExpanded = expandedMatchId === match.id;

        return (
            <div key={match.id} className={`match-card card ${status}${isTechnical ? ' technical' : ''}`}>
                {isLive ? (
                    <Link
                        to="/schedule"
                        state={{ filter: 'live', matchId: match.id }}
                        className="match-card-nav-link"
                        aria-label={`עבור ללוח משחקים לייב — ${team1Name} נגד ${team2Name}`}
                    >
                        {cardBody}
                    </Link>
                ) : (
                    cardBody
                )}

                <div className="match-actions">
                    <MatchCommentsToggle
                        expanded={isExpanded}
                        status={status}
                        commentCount={match.commentCount}
                        controlsId={expandPanelId}
                        onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                    />
                </div>

                {isExpanded && (
                    <div id={expandPanelId}>
                        {status !== 'upcoming' ? (
                            <MatchStatsSection
                                match={match}
                                team1Name={team1Name}
                                team2Name={team2Name}
                                teams={data?.teams}
                                active
                            />
                        ) : null}
                        <CommentSection matchId={match.id} />
                    </div>
                )}
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
                    <div className="alert custom-claim-banner custom-claim-banner--dashboard alert-dismissible d-flex flex-column flex-sm-row align-items-center justify-content-between mb-4 shadow-sm text-center text-sm-start" role="alert">
                        <div className="mb-2 mb-sm-0 pe-sm-4">
                            <strong>שחקן בטורניר? </strong>
                            <span className="ms-2">שייך את המשתמש שלך לפרופיל השחקן כדי לצפות בסטטיסטיקות אישיות.</span>
                        </div>
                        <button className="btn btn-warning btn-sm fw-bold px-4 rounded-pill" onClick={handleClaimClick}>
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

                <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">דף הבית</h2>

                {!hasDashboardContent && (
                    <EmptyState
                        title="אין תוכן להצגה עדיין"
                        message="משחקים קרובים, תוצאות אחרונות ופלייאוף יופיעו כאן לאחר רישום הקבוצות, פרסום לוח המשחקים והתחלת העונה."
                    />
                )}

                {hasLiveMatches && (
                    <div className="dashboard-card live-matches-card">
                        <h2 className="dashboard-card-title">משחקים לייב</h2>
                        <div className="dashboard-match-list">
                            {liveMatches.map(renderMatchCard)}
                        </div>
                    </div>
                )}

                {hasNextMatches && (
                    <div className="dashboard-card next-matches-card">
                        <div className="dashboard-card-title share-section-title">
                            <h2>המשחקים הבאים</h2>
                            <ShareButton
                                filename="upcoming-matches.png"
                                snapshot={upcomingMatchesShareSnapshot(upcomingMatches)}
                                title="המשחקים הבאים"
                                text="המשחקים הבאים בטורניר"
                                className="share-button--on-primary"
                                prepare={prepareUpcomingShare}
                                renderContent={(prepared) =>
                                    prepared ? (
                                        <MatchListShareCard
                                            title="המשחקים הבאים"
                                            matches={prepared.matches}
                                            variant="upcoming"
                                            winChances={prepared.winChances}
                                        />
                                    ) : null
                                }
                            />
                        </div>
                        <div className="dashboard-match-list">
                            {upcomingMatches.map(renderMatchCard)}
                        </div>
                    </div>
                )}

                {data.playoffMatches && data.playoffMatches.length > 0 && (
                    <PlayoffBracket matches={data.playoffMatches} />
                )}

                <div className="dashboard-cards-row">
                {hasTopScorers && (
                    <div className="dashboard-card top-scorer">
                        <div className="dashboard-card-title share-section-title">
                            <h2>מלך השערים</h2>
                            <ShareButton
                                filename="top-scorers.png"
                                snapshot={topScorersShareSnapshot(topScorers, 3)}
                                title="מלכי השערים"
                                text="שלושת המבקיעים המובילים בטורניר"
                                className="share-button--on-primary"
                                prepare={async () => topScorers.slice(0, 3)}
                                renderContent={(scorers) =>
                                    scorers ? (
                                        <TopScorersShareCard scorers={scorers} limit={3} />
                                    ) : null
                                }
                            />
                        </div>
                        <div className="scorer-info">
                            <button
                                type="button"
                                className="premium-scorer-wrapper w-100 border-0 bg-transparent text-center"
                                onClick={() => goToPlayer(topScorers[0].teamId, topScorers[0].memberId)}
                                aria-label={`פרטי שחקן ${topScorers[0].playerName}, ${topScorers[0].teamName}`}
                            >
                                <div className="premium-decorations">
                                    <span className="star-decoration star-1">★</span>
                                    <span className="star-decoration star-2">★</span>
                                    <span className="star-decoration star-3">★</span>
                                </div>
                                <div className="scorer-name">
                                    <PlayerHeadImg
                                        player={toHeadPlayer(topScorers[0])}
                                        alt=""
                                        className="scorer-head-img"
                                    />
                                    <img src="/top-scorer.svg" alt="" className="top-scorer-badge" />
                                    {topScorers[0].playerName}
                                </div>
                                <div className="scorer-team">{topScorers[0].teamName}</div>
                                <div className="scorer-goals">
                                    <span className="goals-count">{topScorers[0].goals}</span>
                                    <span className="goals-label">שערים</span>
                                </div>
                            </button>
                            {topScorers.length > 1 && (
                                <div className="runners-up-list">
                                    {topScorers.slice(1, 3).map((scorer, index) => (
                                        <button
                                            type="button"
                                            key={scorer.memberId}
                                            className="runner-up-item w-100 border-0 bg-transparent text-start"
                                            onClick={() => goToPlayer(scorer.teamId, scorer.memberId)}
                                            aria-label={`פרטי שחקן ${scorer.playerName}, ${scorer.teamName}`}
                                        >
                                            <PlayerHeadImg
                                                player={toHeadPlayer(scorer)}
                                                alt=""
                                                className="runner-head-img"
                                            />
                                            <span className="runner-rank">{index + 2}.</span>
                                            <span className="runner-name">{scorer.playerName}</span>
                                            <span className="runner-team">({scorer.teamName})</span>
                                            <span className="runner-goals fw-bold text-success ms-auto ps-2">{scorer.goals}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {playedRecentMatches.length > 0 && (
                    <div className="dashboard-card recent-matches">
                        <div className="dashboard-card-title share-section-title">
                            <h2>משחקים אחרונים</h2>
                            <ShareButton
                                filename="recent-matches.png"
                                snapshot={recentMatchesShareSnapshot(
                                    playedRecentMatches.slice(0, 5)
                                )}
                                title="משחקים אחרונים"
                                text="תוצאות המשחקים האחרונים בטורניר"
                                className="share-button--on-primary"
                                prepare={async () => playedRecentMatches.slice(0, 5)}
                                renderContent={(matches) =>
                                    matches ? (
                                        <MatchListShareCard
                                            title="משחקים אחרונים"
                                            matches={matches}
                                            variant="finished"
                                        />
                                    ) : null
                                }
                            />
                        </div>
                        <div className="matches-list">
                            {playedRecentMatches.slice(0, 5).map((match) => {
                                const team1Name = match.team1Name || `קבוצה ${match.team1Id}`;
                                const team2Name = match.team2Name || `קבוצה ${match.team2Id}`;
                                const team1Logo =
                                    match.team1LogoPosition === 'none'
                                        ? undefined
                                        : resolveAssetUrl(match.team1LogoUrl);
                                const team2Logo =
                                    match.team2LogoPosition === 'none'
                                        ? undefined
                                        : resolveAssetUrl(match.team2LogoUrl);
                                return (
                                <button
                                    type="button"
                                    key={match.id}
                                    className={`match-item w-100 text-start${match.technicalWinnerTeamId != null ? ' match-item--technical' : ''}`}
                                    onClick={() =>
                                        navigate('/schedule', {
                                            state: { filter: 'finished', matchId: match.id },
                                        })
                                    }
                                >
                                    <span className="match-date">
                                        {formatDate(match.date)}
                                        {match.phase === 'knockout' && <span className="playoff-tag-mini ms-2">פלייאוף</span>}
                                        {match.technicalWinnerTeamId != null && (
                                            <span className="technical-tag-mini ms-2">ניצחון טכני</span>
                                        )}
                                    </span>
                                    <MatchTeamsScore
                                        team1Name={team1Name}
                                        team2Name={team2Name}
                                        score1={match.score1}
                                        score2={match.score2}
                                        showScores
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
                                </button>
                                );
                            })}
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
