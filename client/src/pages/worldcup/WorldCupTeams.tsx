import { useEffect, useMemo, useState } from 'react';
import { worldcupAPI } from '../../api/client';
import type { Team } from '../../types';
import SEO from '../../components/SEO';
import { WorldCupTeamsSkeleton } from '../../components/skeleton';
import { useMinSkeletonTime } from '../../hooks/useMinSkeletonTime';

const POSITION_SECTIONS: { keys: string[]; label: string }[] = [
  { keys: ['שוער', 'Goalkeeper'], label: 'שוערים' },
  { keys: ['הגנה', 'Defence', 'Defender'], label: 'הגנה' },
  { keys: ['קישור', 'Midfield', 'Midfielder'], label: 'קישור' },
  { keys: ['התקפה', 'חלוץ', 'Offence', 'Attacker', 'Forward'], label: 'התקפה' },
];

function groupPlayersByPosition(players: Team['players']) {
  const buckets = new Map<string, Team['players']>();
  const other: Team['players'] = [];

  for (const p of players) {
    const section = POSITION_SECTIONS.find((s) => s.keys.includes(p.position));
    if (section) {
      const list = buckets.get(section.label) || [];
      list.push(p);
      buckets.set(section.label, list);
    } else {
      other.push(p);
    }
  }

  const sortByNumber = (a: Team['players'][number], b: Team['players'][number]) =>
    (a.number || 99) - (b.number || 99);

  const result: { label: string; players: Team['players'] }[] = [];
  for (const { label } of POSITION_SECTIONS) {
    const list = buckets.get(label);
    if (list?.length) {
      result.push({ label, players: [...list].sort(sortByNumber) });
    }
  }
  if (other.length) {
    result.push({ label: 'אחר', players: [...other].sort(sortByNumber) });
  }
  return result;
}

const WorldCupTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await worldcupAPI.getTeams();
        setTeams(res.data);
        setError('');
      } catch {
        setError('שגיאה בטעינת נבחרות');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'he'));
    if (!q) return sorted;
    return sorted.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, query]);

  const showSkeleton = useMinSkeletonTime(loading, { error });

  if (showSkeleton) {
    return <WorldCupTeamsSkeleton label="טוען נבחרות..." />;
  }

  if (error) {
    return (
      <div className="error" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="container py-4 wc-teams-page">
      <SEO
        title="מונדיאל 2026 — נבחרות"
        description="רשימת נבחרות ושחקנים — מונדיאל 2026."
        pathname="/world-cup/teams"
      />
      <h2 className="mb-3 fw-bold tournament-page-title border-bottom pb-2">נבחרות</h2>

      {teams.length > 0 && (
        <div className="wc-teams-toolbar mb-4">
          <label htmlFor="wc-team-search" className="visually-hidden">
            חיפוש נבחרת
          </label>
          <input
            id="wc-team-search"
            type="search"
            className="form-control wc-team-search"
            placeholder="חיפוש נבחרת..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="wc-teams-count text-muted">
            {filteredTeams.length} נבחרות
          </span>
        </div>
      )}

      {teams.length === 0 && (
        <p className="text-muted text-center">נתוני סגל עדיין לא זמינים.</p>
      )}

      {teams.length > 0 && filteredTeams.length === 0 && (
        <p className="text-muted text-center">לא נמצאו נבחרות התואמות לחיפוש.</p>
      )}

      <div className="wc-teams-list">
        {filteredTeams.map((team) => {
          const isOpen = expandedTeam === team.id;
          const sections = groupPlayersByPosition(team.players);

          return (
            <article key={team.id} className={`wc-team-card card ${isOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="wc-team-header btn w-100 border-0 bg-transparent"
                aria-expanded={isOpen}
                aria-controls={`wc-squad-${team.id}`}
                onClick={() => setExpandedTeam(isOpen ? null : team.id)}
              >
                {team.logoUrl && (
                  <img
                    className="wc-team-crest"
                    src={team.logoUrl}
                    alt=""
                    width={40}
                    height={40}
                  />
                )}
                <span className="wc-team-title">
                  <span className="wc-team-name">{team.name}</span>
                  <span className="wc-team-meta">
                    {team.players.length > 0
                      ? `${team.players.length} שחקנים`
                      : 'סגל לא פורסם'}
                  </span>
                </span>
                <span className="wc-team-chevron" aria-hidden="true">
                  {isOpen ? '▴' : '▾'}
                </span>
              </button>

              {isOpen && (
                <div id={`wc-squad-${team.id}`} className="wc-squad">
                  {team.players.length === 0 ? (
                    <p className="text-muted small mb-0 px-3 pb-3">סגל לא פורסם עדיין.</p>
                  ) : (
                    sections.map(({ label, players }) => (
                      <section key={label} className="wc-squad-section">
                        <h3 className="wc-squad-section-title">{label}</h3>
                        <ul className="wc-squad-grid list-unstyled mb-0">
                          {players.map((p) => (
                            <li key={p.memberId} className="wc-player-chip">
                              <span className="wc-player-num">
                                {p.number > 0 ? p.number : '—'}
                              </span>
                              <span className="wc-player-name">{p.nickname}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default WorldCupTeams;
