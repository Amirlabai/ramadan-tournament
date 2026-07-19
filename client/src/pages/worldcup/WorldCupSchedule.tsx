import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { worldcupAPI } from '../../api/client';
import type { Match } from '../../types';
import SEO from '../../components/SEO';
import { WorldCupScheduleSkeleton } from '../../components/skeleton';
import { useMinSkeletonTime } from '../../hooks/useMinSkeletonTime';
import { MatchTeamsScore } from '../../components/match/MatchCardParts';
import { wcGroupLabel } from '../../utils/worldCupLocale';
import '../../pages/Schedule.css';

const LIVE_STATUSES = new Set(['LIVE', 'IN_PLAY', 'PAUSED']);
const FINISHED_STATUSES = new Set(['FINISHED', 'AWARDED']);
const LIVE_LABEL = 'שידור חי';

function getMatchStatus(match: Match): 'upcoming' | 'live' | 'finished' {
  if (match.status && LIVE_STATUSES.has(match.status)) return 'live';
  if (match.status && FINISHED_STATUSES.has(match.status)) return 'finished';
  if (match.score1 != null && match.score2 != null) return 'finished';
  return 'upcoming';
}

function statusLabel(status: ReturnType<typeof getMatchStatus>): string {
  if (status === 'upcoming') return 'עתיד';
  if (status === 'live') return LIVE_LABEL;
  return 'הסתיים';
}

const WorldCupSchedule = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'live' | 'finished'>('all');
  const [scrollMatchId, setScrollMatchId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { filter?: typeof activeFilter; matchId?: string };
    if (state?.filter) {
      setActiveFilter(state.filter);
    }
    if (state?.matchId) {
      setScrollMatchId(state.matchId);
    }
    if (state?.filter || state?.matchId) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!loading && scrollMatchId) {
      const timer = setTimeout(() => {
        document.getElementById(`wc-match-${scrollMatchId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        setScrollMatchId(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, scrollMatchId]);

  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await worldcupAPI.getMatches();
      setMatches(res.data);
      setError('');
    } catch (err) {
      if (!isBackground) setError('שגיאה בטעינת משחקים');
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      const hasLive = matches.some((m) => getMatchStatus(m) === 'live');
      if (hasLive) fetchData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [matches.length]);

  const showSkeleton = useMinSkeletonTime(loading, { error });

  if (showSkeleton) {
    return <WorldCupScheduleSkeleton label="טוען לוח משחקים..." />;
  }
  if (error) return <div className="error" role="alert">{error}</div>;

  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jerusalem',
    }).format(new Date(dateString));

  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const filteredMatches = (() => {
    const base =
      activeFilter === 'all'
        ? sortedMatches
        : sortedMatches.filter((m) => getMatchStatus(m) === activeFilter);
    return activeFilter === 'finished' ? [...base].reverse() : base;
  })();

  const filterOptions: { key: typeof activeFilter; label: string }[] = [
    { key: 'all', label: 'הכל' },
    { key: 'upcoming', label: 'עתיד' },
    { key: 'live', label: LIVE_LABEL },
    { key: 'finished', label: 'הסתיים' },
  ];

  const crest = (url?: string, name?: string) =>
    url ? <img src={url} alt={name ? `דגל ${name}` : ''} className="team-logo-inline" /> : null;

  return (
    <div className="schedule-page container py-4">
      <SEO
        title="מונדיאל 2026: משחקים"
        description="לוח משחקים מלא למונדיאל 2026. תוצאות, זמנים ומיקומים."
        pathname="/world-cup/schedule"
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
                {sortedMatches.filter((m) => getMatchStatus(m) === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredMatches.length === 0 ? (
        <p className="text-muted text-center py-4" role="status">
          אין משחקים בקטגוריה זו.
        </p>
      ) : (
        <div className="matches-list">
          {filteredMatches.map((match) => {
            const status = getMatchStatus(match);
            return (
              <div
                key={match.id}
                id={`wc-match-${match.id}`}
                className={`match-card card ${status}`}
              >
                <span className={`match-status ${status}`}>
                  {statusLabel(status)}
                </span>

                {match.phase === 'knockout' && (
                  <div className="playoff-badge-floating">נוקאאוט</div>
                )}

                <MatchTeamsScore
                  team1Name={match.team1Name || `קבוצה ${match.team1Id}`}
                  team2Name={match.team2Name || `קבוצה ${match.team2Id}`}
                  score1={match.score1}
                  score2={match.score2}
                  showScores={status !== 'upcoming'}
                  team1Logo={crest(match.team1LogoUrl, match.team1Name)}
                  team2Logo={crest(match.team2LogoUrl, match.team2Name)}
                  vsLabel="נגד"
                />

                <div className="match-meta">
                  <span className="match-date">{formatDate(match.date)}</span>
                  <span className="match-location">{match.location}</span>
                  {match.group && <span className="match-group">{wcGroupLabel(match.group)}</span>}
                </div>

                {match.goals && match.goals.length > 0 && (
                  <div className="match-goals">
                    <h4>כובשים:</h4>
                    <ul className="goals-list list-unstyled mb-0">
                      {match.goals.map((g, i) => (
                        <li key={`${g.memberId}-${g.minute}-${i}`} className="goal-item">
                          {g.playerName || g.memberId} ({g.minute}&apos;) ⚽
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorldCupSchedule;
