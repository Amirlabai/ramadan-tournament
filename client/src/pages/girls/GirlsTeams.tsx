import { useCallback, useEffect, useState } from 'react';
import { teamsAPI, votesAPI } from '../../api/client';
import TeamRegistrationActions from '../../components/registration/TeamRegistrationActions';
import TeamOwnerSettings from '../../components/registration/TeamOwnerSettings';
import OwnerSquadRoles from '../../components/registration/OwnerSquadRoles';
import SEO from '../../components/SEO';
import { GirlsTeamsSkeleton } from '../../components/skeleton';
import { useMinSkeletonTime } from '../../hooks/useMinSkeletonTime';
import { useAuth } from '../../contexts/AuthContext';
import { useTournament } from '../../contexts/TournamentContext';
import type { Team } from '../../types';
import { trackEvent } from '../../utils/analytics';

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

  const loadTeams = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

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
      const res = await votesAPI.castGirlsTeam(teamId, 'mvp');
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

  const showSkeleton = useMinSkeletonTime(seasonLoading || loading, {
    error: seasonError || error,
  });

  if (showSkeleton) {
    return <GirlsTeamsSkeleton label="טוען קבוצות..." />;
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
          const ownedTeamId = user?.tournamentRegistration?.girls?.ownedTeamId;
          const rosterReg = user?.tournamentRegistration?.girls?.onRoster;
          const isOwner = ownedTeamId === team.id;
          const isCaptain = rosterReg?.isCaptain === true && rosterReg.teamId === team.id;
          const canEditSquadRoles = isOwner || isCaptain;
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
                  onClick={() => {
                    const nextExpanded = expandedTeam === team.id ? null : team.id;
                    if (nextExpanded !== null) {
                      trackEvent('team_expand', {
                        category: 'browse',
                        properties: { teamId: team.id, division: 'girls', expanded: true },
                      });
                    }
                    setExpandedTeam(nextExpanded);
                  }}
                >
                  <span className="fw-bold">{team.name}</span>
                  <span className="badge tournament-badge">{team.totalPoints ?? 0} נקודות</span>
                </button>
              </div>
              {expandedTeam === team.id && (
                <div className="team-players p-3 border-top">
                  {team.description && !isOwner ? (
                    <p className="text-muted small mb-3">{team.description}</p>
                  ) : null}
                  {isOwner && (
                    <TeamOwnerSettings
                      key={`owner-settings-girls-${team.id}`}
                      teamId={team.id}
                      slug="girls"
                      variant="inline"
                      initialTeam={{
                        name: team.name,
                        description: team.description,
                        logoUrl: team.logoUrl,
                        logoPosition: team.logoPosition,
                      }}
                      onUpdated={() => void loadTeams()}
                    />
                  )}
                  <TeamRegistrationActions teamId={team.id} teamName={team.name} slug="girls" />
                  {canEditSquadRoles && (
                    <OwnerSquadRoles
                      key={team.id}
                      teamId={team.id}
                      players={players}
                      slug="girls"
                      onSaved={() => void loadTeams()}
                    />
                  )}
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
