import { useEffect, useState } from 'react';
import { teamsAPI } from '../../api/client';
import SEO from '../../components/SEO';
import { useTournament } from '../../contexts/TournamentContext';
import type { Team } from '../../types';

type GirlsTeam = Team & { totalPoints?: number };

const GirlsTeams = () => {
  const { seasonLoading, seasonError } = useTournament();
  const [teams, setTeams] = useState<GirlsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await teamsAPI.getAll('girls');
        setTeams(Array.isArray(res.data) ? res.data : []);
        setError('');
      } catch {
        setError('שגיאה בטעינת קבוצות');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (seasonLoading || loading) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">טוען...</span>
        </div>
      </div>
    );
  }

  if (seasonError || error) {
    return (
      <div className="alert alert-secondary m-3" role="alert">
        {seasonError || error}
      </div>
    );
  }

  return (
    <div className="container py-4">
      <SEO
        title="קבוצות — טורניר בנות"
        description="רשימת הקבוצות והסגלים בטורניר בנות רמדאן 2026, כולל סך נקודות לכל קבוצה."
        url="https://ramadan-tournament-client.vercel.app/teams-girls"
      />
      <h2 className="mb-4 fw-bold text-success border-bottom pb-2">קבוצות הטורניר</h2>

      <div className="teams-list">
        {teams.map((team) => {
          const players = team.players ?? [];
          return (
          <article key={team.id} className="team-card mb-3" id={`team-row-${team.id}`}>
            <button
              type="button"
              className="team-header w-100 border-0 bg-transparent text-end p-3 d-flex justify-content-between align-items-center"
              aria-expanded={expandedTeam === team.id}
              onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
            >
              <span className="fw-bold">{team.name}</span>
              <span className="badge bg-success">
                {team.totalPoints ?? 0} נקודות
              </span>
            </button>
            {expandedTeam === team.id && (
              <div className="team-players p-3 border-top">
                {players.length === 0 ? (
                  <p className="text-muted mb-0">אין שחקנים רשומים</p>
                ) : (
                  <ul className="list-unstyled mb-0">
                    {players.map((p) => (
                      <li key={p.memberId} className="py-1">
                        {p.nickname || `${p.firstName} ${p.lastName}`.trim()}
                        {p.number ? ` (#${p.number})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </article>
          );
        })}
        {teams.length === 0 && (
          <p className="text-center text-muted">אין קבוצות רשומות לעונה זו</p>
        )}
      </div>
    </div>
  );
};

export default GirlsTeams;
