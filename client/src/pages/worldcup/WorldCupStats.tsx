import { useEffect, useMemo, useState } from 'react';
import { worldcupAPI } from '../../api/client';
import type { GroupStanding, Match, TopScorer } from '../../types';
import SEO from '../../components/SEO';
import { WorldCupStatsSkeleton } from '../../components/skeleton';
import { useMinSkeletonTime } from '../../hooks/useMinSkeletonTime';
import WorldCupBracket from '../../components/WorldCupBracket';
import { filterDisplayableKnockoutMatches } from '../../utils/worldCupKnockout';
import { wcGroupLabel } from '../../utils/worldCupLocale';
import { TOURNAMENT_POLL_INTERVAL_MS } from '@ramadan-tournament/shared';
import '../../pages/Stats.css';

const GROUP_ORDER = [
  'GROUP_A', 'GROUP_B', 'GROUP_C', 'GROUP_D', 'GROUP_E', 'GROUP_F',
  'GROUP_G', 'GROUP_H', 'GROUP_I', 'GROUP_J', 'GROUP_K', 'GROUP_L',
];

function sortGroupKeys(a: string, b: string): number {
  const ia = GROUP_ORDER.indexOf(a);
  const ib = GROUP_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

const WorldCupStats = () => {
  const [standings, setStandings] = useState<GroupStanding[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [knockoutMatches, setKnockoutMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const [standingsRes, scorersRes, knockoutRes] = await Promise.all([
        worldcupAPI.getStandings(),
        worldcupAPI.getTopScorers(),
        worldcupAPI.getKnockout(),
      ]);
      setStandings(standingsRes.data);
      setTopScorers(scorersRes.data);
      setKnockoutMatches(knockoutRes.data);
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

    const interval = setInterval(() => {
      const hasLive = knockoutMatches.some(
        (m) => m.status === 'LIVE' || m.status === 'IN_PLAY'
      );
      if (hasLive) fetchStats(true);
    }, TOURNAMENT_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, GroupStanding[]>();
    for (const row of standings) {
      const list = map.get(row.group) || [];
      list.push(row);
      map.set(row.group, list);
    }
    for (const [key, rows] of map) {
      rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
      map.set(key, rows);
    }
    return [...map.entries()].sort(([a], [b]) => sortGroupKeys(a, b));
  }, [standings]);

  const showSkeleton = useMinSkeletonTime(loading, { error });

  if (showSkeleton) {
    return <WorldCupStatsSkeleton label="טוען סטטיסטיקות..." />;
  }
  if (error) return <div className="error" role="alert">{error}</div>;

  return (
    <div className="stats-page wc-stats-page container py-3">
      <SEO
        title="מונדיאל 2026: סטטיסטיקות"
        description="טבלאות בתים, מלכי השערים ושלב הנוקאאוט למונדיאל 2026."
        pathname="/world-cup/stats"
      />
      <h2 className="mb-3 fw-bold tournament-page-title border-bottom pb-2">סטטיסטיקות</h2>

      {filterDisplayableKnockoutMatches(knockoutMatches).length > 0 && (
        <WorldCupBracket matches={knockoutMatches} />
      )}

      <div className="wc-stats-layout">
        {groups.length === 0 && (
          <p className="text-muted text-center mb-4">טבלאות בתים עדיין לא זמינות.</p>
        )}
        <div className="wc-group-grid">
          {groups.map(([group, rows]) => (
            <div key={group} className="card standings-table wc-group-card">
              <h3 className="dashboard-card-title">{wcGroupLabel(group)}</h3>
              <table className="wc-group-table">
                <caption className="visually-hidden">דירוג {wcGroupLabel(group)}</caption>
                <thead>
                  <tr>
                    <th scope="col"><abbr title="דירוג">#</abbr></th>
                    <th scope="col">נבחרת</th>
                    <th scope="col"><abbr title="משחקים">מ&apos;</abbr></th>
                    <th scope="col" className="wc-wdl-col">
                      <abbr title="ניצחונות / תיקו / הפסדים (מימין לשמאל)">נ/ת/ה</abbr>
                    </th>
                    <th scope="col"><abbr title="שערים זכות">ז</abbr></th>
                    <th scope="col"><abbr title="שערים חובה">ח</abbr></th>
                    <th scope="col"><abbr title="הפרש שערים">+/-</abbr></th>
                    <th scope="col"><abbr title="נקודות">נק&apos;</abbr></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((team, index) => (
                    <tr key={team.teamId}>
                      <td className="position">{index + 1}</td>
                      <td className="team-name">{team.teamName}</td>
                      <td>{team.played}</td>
                      <td className="wc-wdl">
                        <span className="visually-hidden">
                          {team.won} ניצחונות, {team.drawn} תיקו, {team.lost} הפסדים
                        </span>
                        <span aria-hidden="true">{team.lost}/{team.drawn}/{team.won}</span>
                      </td>
                      <td>{team.goalsFor}</td>
                      <td>{team.goalsAgainst}</td>
                      <td>{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</td>
                      <td className="points">{team.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="card top-scorers-list wc-scorers-panel">
          <h3 className="dashboard-card-title">מלכי השערים</h3>
          {topScorers.length === 0 ? (
            <p className="text-muted text-center mb-0 py-3">נתוני מלכי השערים עדיין לא זמינים.</p>
          ) : (
            <div className="scorers-list">
              {topScorers.slice(0, 10).map((scorer, index) => (
                <div key={scorer.memberId} className="scorer-item w-100 text-start">
                  <span className="scorer-rank">{index + 1}</span>
                  <span className="scorer-name">{scorer.playerName}</span>
                  <span className="scorer-team">{scorer.teamName}</span>
                  <span className="scorer-goals">{scorer.goals} ⚽</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorldCupStats;
