import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { worldcupAPI } from '../../api/client';
import type { DashboardData } from '../../types';
import SEO from '../../components/SEO';
import { WorldCupDashboardSkeleton } from '../../components/skeleton';
import { filterDisplayableKnockoutMatches } from '../../utils/worldCupKnockout';
import { useTournament } from '../../contexts/TournamentContext';
import '../../pages/Dashboard.css';

const WorldCupDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { seasonLoading, seasonError } = useTournament();
  const navigate = useNavigate();

  const fetchDashboard = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const response = await worldcupAPI.getDashboard();
      setData(response.data);
      setError('');
    } catch (err) {
      if (!isBackground) setError('שגיאה בטעינת נתוני מונדיאל');
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(() => {
      const hasLive = data?.nextMatches?.some(
        (m) => m.status === 'LIVE' || m.status === 'IN_PLAY' || m.status === 'PAUSED'
      );
      const hasRecentLive = data?.recentMatches?.some(
        (m) => m.status === 'LIVE' || m.status === 'IN_PLAY'
      );
      if (hasLive || hasRecentLive) {
        fetchDashboard(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [data?.nextMatches?.length]);

  if (seasonLoading || loading) {
    return <WorldCupDashboardSkeleton label="טוען נתוני מונדיאל..." />;
  }

  if (seasonError || error) {
    return (
      <div className="error" role="alert">
        {seasonError || error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="error" role="alert">
        אין נתונים
      </div>
    );
  }

  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat('he-IL', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Jerusalem',
    }).format(new Date(dateString));

  const formatTime = (dateString: string) =>
    new Intl.DateTimeFormat('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jerusalem',
    }).format(new Date(dateString));

  const renderCrest = (name: string, crest?: string) => (
    <div className="d-flex align-items-center gap-2">
      {crest && (
        <img
          src={crest}
          alt={`דגל ${name}`}
          className="team-logo-inline"
          style={{ height: 24, width: 24 }}
        />
      )}
      <span className="team-name">{name}</span>
    </div>
  );

  const hasKnockout = data.playoffMatches && filterDisplayableKnockoutMatches(data.playoffMatches).length > 0;

  return (
    <div className="dashboard-page">
      <SEO
        title="מונדיאל 2026 — דף הבית"
        description="תוצאות, משחקים קרובים ומלכי השערים — מונדיאל 2026."
        pathname="/world-cup"
      />
      <div className="container py-4">
        <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">מונדיאל 2026</h2>

        {hasKnockout && (
          <p className="text-center mb-4">
            <button
              type="button"
              className="btn btn-link"
              onClick={() => navigate('/world-cup/stats')}
            >
              צפה בשלב הנוקאאוט המלא
            </button>
          </p>
        )}

        {data.nextMatches && data.nextMatches.length > 0 && (
          <div className="dashboard-card next-matches-card">
            <h2 className="dashboard-card-title">המשחקים הבאים</h2>
            <div className="next-matches-list">
              {data.nextMatches.map((match) => (
                <div key={match.id} className="upcoming-match-item">
                  <div className="match-main-info">
                    <div className="team-right">
                      {renderCrest(match.team1Name || `קבוצה ${match.team1Id}`, match.team1LogoUrl)}
                    </div>
                    <div className="match-vs">
                      <span className="vs-badge">נגד</span>
                    </div>
                    <div className="team-left">
                      {renderCrest(match.team2Name || `קבוצה ${match.team2Id}`, match.team2LogoUrl)}
                    </div>
                  </div>
                  {match.phase === 'knockout' && (
                    <div className="playoff-indicator-badge">נוקאאוט</div>
                  )}
                  <div className="match-meta" style={{ textAlign: 'right', direction: 'rtl' }}>
                    <div><strong>תאריך:</strong> {formatDate(match.date)}</div>
                    <div><strong>שעה:</strong> {formatTime(match.date)}</div>
                    <div><strong>מיקום:</strong> {match.location}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dashboard-cards-row">
        {data.recentMatches && data.recentMatches.length > 0 && (
          <div className="dashboard-card recent-matches">
            <h2 className="dashboard-card-title">משחקים אחרונים</h2>
            <div className="matches-list">
              {data.recentMatches.slice(0, 5).map((match) => (
                <button
                  type="button"
                  key={match.id}
                  className="match-item w-100 border-0 text-start bg-transparent"
                  onClick={() =>
                    navigate('/world-cup/schedule', {
                      state: { filter: 'finished', matchId: match.id },
                    })
                  }
                >
                  <span className="match-date">
                    {formatDate(match.date)}
                    {match.phase === 'knockout' && <span className="playoff-tag-mini ms-2">נוקאאוט</span>}
                  </span>
                  <div className="match-score">
                    <div className="team-home">
                      {renderCrest(match.team1Name || `קבוצה ${match.team1Id}`, match.team1LogoUrl)}
                    </div>
                    <span className="score">{match.score1} - {match.score2}</span>
                    <div className="team-away">
                      {renderCrest(match.team2Name || `קבוצה ${match.team2Id}`, match.team2LogoUrl)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {data.topScorers && data.topScorers.length > 0 && (
          <div className="dashboard-card top-scorer">
            <h2 className="dashboard-card-title">מלך השערים</h2>
            <div className="scorer-info">
              <div className="premium-scorer-wrapper text-center">
                <div className="premium-decorations" aria-hidden="true">
                  <span className="star-decoration star-1">★</span>
                  <span className="star-decoration star-2">★</span>
                  <span className="star-decoration star-3">★</span>
                </div>
                <div className="scorer-name">
                  <img src="/top-scorer.svg" alt="" className="top-scorer-badge" />
                  {data.topScorers[0].playerName}
                </div>
                <div className="scorer-team">{data.topScorers[0].teamName}</div>
                <div className="scorer-goals">
                  <span className="goals-count">{data.topScorers[0].goals}</span>
                  <span className="goals-label">שערים</span>
                </div>
              </div>

              {data.topScorers.length > 1 && (
                <div className="runners-up-list">
                  {data.topScorers.slice(1, 3).map((scorer, index) => (
                    <div key={scorer.memberId} className="runner-up-item">
                      <span className="runner-rank">{index + 2}.</span>
                      <span className="runner-name">{scorer.playerName}</span>
                      <span className="runner-team">({scorer.teamName})</span>
                      <span className="runner-goals fw-bold ms-auto ps-2">{scorer.goals}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-center mb-0 mt-3">
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => navigate('/world-cup/stats')}
                >
                  לטבלת מלכי השערים המלאה
                </button>
              </p>
            </div>
          </div>
        )}
        </div>

      </div>
    </div>
  );
};

export default WorldCupDashboard;
