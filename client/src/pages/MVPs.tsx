import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsAPI, votesAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardData } from '../types';
import SEO from '../components/SEO';
import { MvpsSkeleton } from '../components/skeleton';
import { useMinSkeletonTime } from '../hooks/useMinSkeletonTime';
import { PlayerHeadImg } from '../components/PlayerHeadImg';
import { toHeadPlayer } from '../utils/toHeadPlayer';
import './Dashboard.css'; // Reusing Dashboard styles for the widgets

const MVPs = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [mvpLeaderboard, setMvpLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hasVoted, setHasVoted] = useState<boolean | null>(null);
    const [voteLoaded, setVoteLoaded] = useState(false);
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const goToPlayer = (teamId: number, memberId: number) => {
        navigate('/teams', { state: { expandTeamId: teamId, selectPlayerId: memberId } });
    };

    const resolveTeamId = (teamName: string): number | null =>
        data?.teams?.find((t: { name: string; id: number }) => t.name === teamName)?.id ?? null;

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
        if (authLoading) return;

        if (!user) {
            setHasVoted(false);
            setVoteLoaded(true);
            return;
        }
        try {
            const response = await votesAPI.getMyVote('mvp');
            setHasVoted(!!response.data?.voted);
        } catch (err) {
            console.error('Error fetching vote:', err);
            setHasVoted(false); // Default to not voted on error
        } finally {
            setVoteLoaded(true);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchMvpLeaderboard();

        // Polling logic: Every 5 minutes
        const interval = setInterval(() => {
            fetchStats(true);
            fetchMvpLeaderboard();
        }, 300000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchMyVote();
    }, [user, authLoading]);

    const showSkeleton = useMinSkeletonTime(loading, { error });

    if (showSkeleton) return <MvpsSkeleton label="טוען מצטיינים..." />;
    if (error) return <div className="alert alert-danger m-3">{error}</div>;
    if (!data) return <div className="error">אין נתונים</div>;

    return (
        <div className="dashboard-page mvps-page">
            <SEO
                title="מצטיינים"
                description="מלכי השערים ומירוץ ה-MVP של טורניר נצ'מאז כפר כמא 2026."
                pathname="/mvps"
            />
            <div className="container py-4">
                <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">מצטייני הטורניר</h2>

                {(voteLoaded && (!user || hasVoted === false)) && (
                    <div className="alert custom-claim-banner custom-claim-banner--mvp-vote d-flex flex-column flex-sm-row align-items-center justify-content-between mb-4 shadow-sm text-center text-sm-start" role="alert">
                        <div className="mb-2 mb-sm-0 pe-sm-4">
                            <strong>{user ? 'טרם בחרת שחקן מצטיין!' : 'מי ה-MVP שלך?'} </strong>
                            <span className="ms-2">
                                {!user ? 'התחבר עכשיו ובחר את השחקן המצטיין של הטורניר!' : 'עברו לעמוד הקבוצות ולחצו על סימון הכוכב (⭐) בכרטסייה של השחקן כדי לבחור בו.'}
                            </span>
                        </div>
                        <button 
                            className="btn btn-light fw-bold px-4 shadow-sm"
                            onClick={() => navigate('/teams')}
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
                                    <button
                                        type="button"
                                        className="premium-scorer-wrapper h-100 w-100 border-0 bg-transparent text-center"
                                        onClick={() => goToPlayer(data.topScorers[0].teamId, data.topScorers[0].memberId)}
                                        aria-label={`פרטי שחקן ${data.topScorers[0].playerName}, ${data.topScorers[0].teamName}`}
                                    >
                                        <div className="premium-decorations">
                                            <span className="star-decoration star-1">★</span>
                                            <span className="star-decoration star-2">★</span>
                                            <span className="star-decoration star-3">★</span>
                                        </div>
                                        <div className="scorer-name">
                                            <PlayerHeadImg
                                                player={toHeadPlayer(data.topScorers[0])}
                                                alt=""
                                                className="scorer-head-img"
                                            />
                                            <img src="/top-scorer.svg" alt="תג מלך השערים" className="top-scorer-badge" />
                                            {data.topScorers[0].playerName}
                                        </div>
                                        <div className="scorer-team">{data.topScorers[0].teamName}</div>
                                        <div className="scorer-goals">
                                            <span className="goals-count">{data.topScorers[0].goals}</span>
                                            <span className="goals-label">שערים</span>
                                        </div>
                                    </button>

                                    {/* 2nd and 3rd Place - Simple Table-like Rows */}
                                    {data.topScorers.length > 1 && (
                                        <div className="runners-up-list">
                                            {data.topScorers.slice(1, 3).map((scorer, index) => (
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
                    </div>

                    <div className="col-md-6 mb-4">
                        {/* MVP Race Leaderboard */}
                        {mvpLeaderboard && mvpLeaderboard.length > 0 && (
                            <div className="dashboard-card mvp-race-card h-100 mt-0">
                                <div className="card-header d-flex justify-content-between align-items-center">
                                    <h3 className="mb-0 fs-4 w-100 text-center">🏆 MVP</h3>
                                </div>
                                <div className="card-body p-0">
                                    {mvpLeaderboard.slice(0, 5).map((item, index) => {
                                        if (!item?.player) return null;
                                        const teamId = item.teamId ?? resolveTeamId(item.teamName);
                                        const playerName = `${item.player.firstName ?? ''} ${item.player.lastName ?? ''}`.trim() || 'שחקן';
                                        return (
                                        <button
                                            type="button"
                                            key={item.memberId}
                                            className={`mvp-row d-flex align-items-center justify-content-between p-3 border-bottom w-100 border-0 bg-transparent text-start ${index === 0 ? 'bg-light-gold' : ''}`}
                                            disabled={teamId === null}
                                            onClick={() => teamId !== null && goToPlayer(teamId, item.memberId)}
                                            aria-label={`פרטי שחקן ${playerName}, ${item.teamName ?? ''}`}
                                        >
                                            <div className="d-flex align-items-center gap-3">
                                                <div className={`mvp-rank fw-bold ${index === 0 ? 'text-warning fs-4' : 'text-secondary'}`}>
                                                    {index + 1}
                                                </div>
                                                <PlayerHeadImg
                                                    player={toHeadPlayer({
                                                        memberId: item.memberId,
                                                        head_photo: item.player?.head_photo,
                                                        isCaptain: item.player?.isCaptain,
                                                        isTeamOwner: item.player?.isTeamOwner,
                                                        squadRole: item.player?.squadRole,
                                                        position: item.player?.position,
                                                    })}
                                                    alt=""
                                                    className="mvp-head-img"
                                                />
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
                                        </button>
                                        );
                                    })}
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
