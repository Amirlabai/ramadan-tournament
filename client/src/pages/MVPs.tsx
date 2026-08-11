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
import { ShareButton } from '../components/share/ShareButton';
import { TopScorersShareCard } from '../components/share/TopScorersShareCard';
import { MvpShareCard, type MvpShareEntry } from '../components/share/MvpShareCard';
import {
  mvpLeaderboardShareSnapshot,
  topScorersShareSnapshot,
} from '../utils/shareSnapshot';
import './Dashboard.css'; // Reusing Dashboard styles for the widgets

/** Boys MVP vote results row from GET /api/votes/results. */
type MvpLeaderboardRow = {
  memberId: number;
  votes: number;
  teamName: string;
  teamId?: number;
  player: {
    firstName?: string | null;
    lastName?: string | null;
    nickname?: string | null;
    head_photo?: string;
    isCaptain?: boolean;
    isTeamOwner?: boolean;
    squadRole?: string | null;
    position?: string | null;
  };
};

function toMvpShareEntries(leaderboard: MvpLeaderboardRow[], limit = 5): MvpShareEntry[] {
  const out: MvpShareEntry[] = [];
  for (const item of leaderboard.slice(0, limit)) {
    if (!item.player || item.memberId == null) continue;
    const playerName =
      `${item.player.firstName ?? ''} ${item.player.lastName ?? ''}`.trim() || 'שחקן';
    out.push({
      memberId: item.memberId,
      playerName,
      teamName: item.teamName ?? '',
      votes: item.votes ?? 0,
      head_photo: item.player.head_photo,
      isCaptain: item.player.isCaptain,
      isTeamOwner: item.player.isTeamOwner,
      squadRole: item.player.squadRole ?? undefined,
      position: item.player.position ?? undefined,
    });
  }
  return out;
}

const MVPs = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mvpLeaderboard, setMvpLeaderboard] = useState<MvpLeaderboardRow[]>([]);
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
      const rows = (response.data.leaderboard || []) as MvpLeaderboardRow[];
      setMvpLeaderboard(rows.filter((r) => r?.player != null && r.memberId != null));
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
      setHasVoted(false);
    } finally {
      setVoteLoaded(true);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchMvpLeaderboard();

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

  const topScorers = data.topScorers ?? [];
  const mvpShareEntries = toMvpShareEntries(mvpLeaderboard, 5);

  return (
    <div className="dashboard-page mvps-page">
      <SEO pathname="/mvps" />
      <div className="container py-4">
        <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">מצטייני הטורניר</h2>

        {voteLoaded && (!user || hasVoted === false) && (
          <div
            className="alert custom-claim-banner custom-claim-banner--mvp-vote d-flex flex-column flex-sm-row align-items-center justify-content-between mb-4 shadow-sm text-center text-sm-start"
            role="alert"
          >
            <div className="mb-2 mb-sm-0 pe-sm-4">
              <strong>{user ? 'טרם בחרת שחקן מצטיין!' : 'מי ה-MVP שלך?'} </strong>
              <span className="ms-2">
                {!user
                  ? 'התחבר עכשיו ובחר את השחקן המצטיין של הטורניר!'
                  : 'עברו לעמוד הקבוצות ולחצו על סימון הכוכב (⭐) בכרטסייה של השחקן כדי לבחור בו.'}
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

        <div className="dashboard-cards-row">
          {topScorers.length > 0 && (
            <div className="dashboard-card top-scorer mt-0">
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
                    scorers ? <TopScorersShareCard scorers={scorers} limit={3} /> : null
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
                    <img
                      src="/top-scorer.svg"
                      alt="תג מלך השערים"
                      className="top-scorer-badge"
                    />
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
                        <span className="runner-goals fw-bold text-success ms-auto ps-2">
                          {scorer.goals}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {mvpShareEntries.length > 0 && (
            <div className="dashboard-card mvp-race-card mt-0">
              <div className="dashboard-card-title share-section-title">
                <h2>MVP</h2>
                <ShareButton
                  filename="mvp-leaderboard.png"
                  snapshot={mvpLeaderboardShareSnapshot(mvpShareEntries, 5)}
                  title="מובילי ה-MVP"
                  text="מובילי ההצבעה לשחקן המצטיין"
                  className="share-button--on-primary"
                  prepare={async () => mvpShareEntries}
                  renderContent={(entries) =>
                    entries ? <MvpShareCard entries={entries} limit={5} /> : null
                  }
                />
              </div>
              <div className="mvp-race-list">
                {mvpShareEntries.map((entry, index) => {
                  const raw = mvpLeaderboard.find((r) => r.memberId === entry.memberId);
                  const teamId = raw?.teamId ?? resolveTeamId(entry.teamName);
                  return (
                    <button
                      type="button"
                      key={entry.memberId}
                      className={`mvp-row d-flex align-items-center justify-content-between p-3 border-bottom w-100 border-0 bg-transparent text-start ${index === 0 ? 'bg-light-gold' : ''}`}
                      disabled={teamId === null}
                      onClick={() => teamId !== null && goToPlayer(teamId, entry.memberId)}
                      aria-label={`פרטי שחקן ${entry.playerName}, ${entry.teamName}`}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className={`mvp-rank fw-bold ${index === 0 ? 'text-warning fs-4' : 'text-secondary'}`}
                        >
                          {index + 1}
                        </div>
                        <PlayerHeadImg
                          player={toHeadPlayer(entry)}
                          alt=""
                          className="mvp-head-img"
                        />
                        <div>
                          <div className="fw-bold fs-6">
                            {entry.playerName}
                            {raw?.player?.nickname && (
                              <span className="text-muted ms-1">({raw.player.nickname})</span>
                            )}
                          </div>
                          <div className="small text-muted">{entry.teamName}</div>
                        </div>
                      </div>
                      <div className="mvp-votes text-center">
                        <div className="fw-bold fs-5 text-success">{entry.votes}</div>
                        <div className="small text-muted" style={{ fontSize: '0.7rem' }}>
                          הצבעות
                        </div>
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
  );
};

export default MVPs;
