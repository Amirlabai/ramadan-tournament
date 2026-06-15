import { useEffect, useState } from 'react';
import { teamsAPI, votesAPI } from '../../api/client';
import TeamRegistrationActions from '../../components/registration/TeamRegistrationActions';
import SEO from '../../components/SEO';
import { useAuth } from '../../contexts/AuthContext';
import { useTournament } from '../../contexts/TournamentContext';
import type { Team } from '../../types';

type GirlsTeam = Team & { totalPoints?: number };

const GirlsTeams = () => {
  const { seasonLoading, seasonError } = useTournament();
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<GirlsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [myVoteTeamId, setMyVoteTeamId] = useState<number | null>(null);
  const [voteLoaded, setVoteLoaded] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const isLoggedIn = !!user;

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

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      setVoteLoaded(true);
      return;
    }
    const loadVote = async () => {
      try {
        const res = await votesAPI.getMyVote('mvp', 'girls');
        if (res.data.voted && res.data.teamId) {
          setMyVoteTeamId(res.data.teamId);
        } else {
          setMyVoteTeamId(null);
        }
      } catch {
        setMyVoteTeamId(null);
      } finally {
        setVoteLoaded(true);
      }
    };
    void loadVote();
  }, [isLoggedIn, authLoading]);

  const handleTeamVote = async (teamId: number) => {
    if (!isLoggedIn) {
      if (window.confirm('יש להתחבר כדי להצביע. לעבור להתחברות?')) {
        window.location.href = '/login';
      }
      return;
    }
    if (isVoting) return;
    try {
      setIsVoting(true);
      const res = await votesAPI.castTeam(teamId, 'mvp');
      if (res.data.voted) {
        setMyVoteTeamId(teamId);
      } else {
        setMyVoteTeamId(null);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      alert(ax.response?.data?.message || 'שגיאה בשליחת ההצבעה');
    } finally {
      setIsVoting(false);
    }
  };

  if (seasonLoading || loading) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border text-tournament-primary" role="status">
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
        pathname="/teams-girls"
      />
      <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">קבוצות הטורניר</h2>

      {voteLoaded && isLoggedIn && !myVoteTeamId && (
        <p className="alert alert-warning mb-4" role="status">
          הצביעו לקבוצה המצטיינת: לחצו על הכוכב ליד שם הקבוצה.
        </p>
      )}

      <div className="teams-list">
        {teams.map((team) => {
          const players = team.players ?? [];
          return (
            <article key={team.id} className="team-card mb-3" id={`team-row-${team.id}`}>
              <div className="d-flex align-items-stretch">
                {isLoggedIn && (
                  <button
                    type="button"
                    className="btn btn-link border-0 px-3 align-self-center"
                    onClick={() => void handleTeamVote(team.id)}
                    disabled={isVoting}
                    aria-label={
                      myVoteTeamId === team.id
                        ? `בטל הצבעה ל${team.name}`
                        : `הצבע ל${team.name} כקבוצה מצטיינת`
                    }
                    aria-pressed={myVoteTeamId === team.id}
                  >
                    <i
                      className={`fs-4 ${
                        myVoteTeamId === team.id
                          ? 'tournament-star-vote fa-solid fa-star'
                          : 'text-secondary fa-regular fa-star'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                )}
                <button
                  type="button"
                  className="team-header flex-grow-1 border-0 bg-transparent text-end p-3 d-flex justify-content-between align-items-center"
                  aria-expanded={expandedTeam === team.id}
                  onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                >
                  <span className="fw-bold">{team.name}</span>
                  <span className="badge tournament-badge">{team.totalPoints ?? 0} נקודות</span>
                </button>
              </div>
              {expandedTeam === team.id && (
                <div className="team-players p-3 border-top">
                  <TeamRegistrationActions teamId={team.id} teamName={team.name} slug="girls" />
                  {players.length === 0 ? (
                    <p className="text-muted mb-0">אין שחקנים רשומים</p>
                  ) : (
                    <ul className="list-unstyled mb-0 mt-2">
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
