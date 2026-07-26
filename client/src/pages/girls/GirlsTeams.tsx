import { useCallback, useEffect, useMemo, useState } from 'react';
import { teamsAPI, votesAPI } from '../../api/client';
import TeamRegistrationActions from '../../components/registration/TeamRegistrationActions';
import TeamOwnerSettings from '../../components/registration/TeamOwnerSettings';
import OwnerSquadRoles from '../../components/registration/OwnerSquadRoles';
import RosterPlayerRow from '../../components/roster/RosterPlayerRow';
import SEO from '../../components/SEO';
import { GirlsTeamsSkeleton } from '../../components/skeleton';
import PageLoading from '../../components/PageLoading';
import { useMinSkeletonTime } from '../../hooks/useMinSkeletonTime';
import { useAuth } from '../../contexts/AuthContext';
import { useTournament } from '../../contexts/TournamentContext';
import type { Team } from '../../types';
import { trackEvent } from '../../utils/analytics';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { isPlatformAdmin } from '../../utils/tournamentUser';
import { sortRosterPlayers } from '../../utils/rosterSort';
import {
  computeTeamsBrowseSummary,
  filterRosterPlayers,
  getTeamTopScorer,
  sortTeamsById,
  teamHasPlayerMatch,
} from '../../utils/teamsBrowse';

type GirlsTeam = Team & { totalPoints?: number };

const GirlsTeams = () => {
  const { seasonLoading, seasonError } = useTournament();
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<GirlsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
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

  const filteredTeams = useMemo(() => {
    const sorted = sortTeamsById(teams);
    if (!query.trim()) return sorted;
    return sorted.filter((t) => teamHasPlayerMatch(t, query));
  }, [teams, query]);

  const browseSummary = useMemo(() => {
    const base = computeTeamsBrowseSummary(teams);
    const totalPoints = teams.reduce((sum, t) => sum + (t.totalPoints ?? 0), 0);
    return { ...base, totalPoints };
  }, [teams]);

  useEffect(() => {
    if (!query.trim()) return;
    if (filteredTeams.length === 0) {
      setExpandedTeam(null);
      return;
    }
    setExpandedTeam((prev) => {
      if (prev != null && filteredTeams.some((t) => t.id === prev)) return prev;
      return filteredTeams[0].id;
    });
  }, [query, filteredTeams]);

  const loadPhase = useMinSkeletonTime(seasonLoading || loading, {
    error: seasonError || error,
  });

  if (loadPhase === 'spinner') {
    return <PageLoading label="טוען קבוצות..." />;
  }
  if (loadPhase === 'skeleton') {
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
    <div className="teams-browse-page browse-page container py-4">
      <SEO
        title="קבוצות: טורניר בנות"
        description="רשימת הקבוצות והסגלים בטורניר בנות רמדאן 2026, כולל סך נקודות לכל קבוצה."
        pathname="/teams-girls"
      />
      <h2 className="mb-0 fw-bold tournament-page-title">קבוצות הטורניר</h2>

      {teams.length === 0 ? (
        <p className="text-center text-muted mt-3">אין קבוצות רשומות לעונה זו</p>
      ) : (
        <>
          <p className="teams-browse-summary" aria-label="סיכום קבוצות">
            <span>
              <strong>{browseSummary.teamCount}</strong> קבוצות
            </span>
            <span className="teams-browse-summary-sep" aria-hidden="true">
              ·
            </span>
            <span>
              <strong>{browseSummary.playerCount}</strong> שחקניות
            </span>
            <span className="teams-browse-summary-sep" aria-hidden="true">
              ·
            </span>
            <span>
              <strong>{browseSummary.totalPoints}</strong> נקודות
            </span>
          </p>

          {voteLoaded && isLoggedIn && !myVoteTeamId && (
            <p className="alert alert-warning mb-3" role="status">
              הצביעו לקבוצה המצטיינת: לחצו על הכוכב ליד שם הקבוצה.
            </p>
          )}

          <div className="teams-browse-toolbar">
            <label htmlFor="girls-teams-browse-search" className="visually-hidden">
              חיפוש שחקנית
            </label>
            <input
              id="girls-teams-browse-search"
              type="search"
              className="form-control teams-browse-search"
              placeholder="חיפוש שחקנית..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {filteredTeams.length === 0 ? (
            <p className="text-muted text-center">לא נמצאו שחקניות התואמות לחיפוש.</p>
          ) : (
            <div className="teams-browse-list">
              {filteredTeams.map((team) => {
                const players = team.players ?? [];
                const captain = players.find((p) => p.isCaptain);
                const isExpanded = expandedTeam === team.id;
                const logoSrc = resolveAssetUrl(team.logoUrl);
                const ownedTeamId = user?.tournamentRegistration?.girls?.ownedTeamId;
                const rosterReg = user?.tournamentRegistration?.girls?.onRoster;
                const isOwner = ownedTeamId === team.id;
                const isCaptain = rosterReg?.isCaptain === true && rosterReg.teamId === team.id;
                const canManageBranding = isOwner || isCaptain || isPlatformAdmin(user);
                const canEditSquadRoles = isOwner || isCaptain;
                const captainName = captain
                  ? `${captain.firstName} ${captain.lastName}`
                  : null;
                const visiblePlayers = filterRosterPlayers(sortRosterPlayers(players), query);
                const topScorerInTeam = getTeamTopScorer(players);

                return (
                  <article
                    key={team.id}
                    id={`team-row-${team.id}`}
                    className={`teams-browse-card${isExpanded ? ' is-open' : ''}`}
                  >
                    <div className="d-flex align-items-stretch">
                      {isLoggedIn ? (
                        <button
                          type="button"
                          className="btn btn-link border-0 px-2 align-self-center teams-browse-team-vote"
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
                      ) : null}
                      <button
                        type="button"
                        className="teams-browse-header btn border-0 bg-transparent flex-grow-1"
                        aria-expanded={isExpanded}
                        aria-controls={`team-details-${team.id}`}
                        aria-label={
                          isExpanded
                            ? `כווץ פרטי ${team.name}`
                            : `הרחב פרטי ${team.name}`
                        }
                        onClick={() => {
                          const nextExpanded = isExpanded ? null : team.id;
                          if (nextExpanded !== null) {
                            trackEvent('team_expand', {
                              category: 'browse',
                              properties: { teamId: team.id, division: 'girls', expanded: true },
                            });
                          }
                          setExpandedTeam(nextExpanded);
                        }}
                      >
                        {logoSrc && team.logoPosition !== 'none' ? (
                          <img
                            className="teams-browse-crest"
                            src={logoSrc}
                            alt=""
                            width={44}
                            height={44}
                          />
                        ) : null}
                        <span className="teams-browse-title">
                          <span className="teams-browse-name">{team.name}</span>
                          <span className="teams-browse-meta">
                            <span className="teams-browse-meta-count">
                              {players.length} שחקניות
                            </span>
                            {captainName ? (
                              <>
                                <span className="teams-browse-summary-sep" aria-hidden="true">
                                  ·
                                </span>
                                <span className="teams-browse-meta-captain">
                                  <span className="teams-browse-meta-captain-label">קפטן</span>
                                  <span className="teams-browse-meta-captain-name" dir="auto">
                                    {captainName}
                                  </span>
                                </span>
                              </>
                            ) : null}
                            {typeof team.totalPoints === 'number' ? (
                              <>
                                <span className="teams-browse-summary-sep" aria-hidden="true">
                                  ·
                                </span>
                                <span className="teams-browse-meta-count">
                                  {team.totalPoints} נק׳
                                </span>
                              </>
                            ) : null}
                          </span>
                        </span>
                        <span className="teams-browse-chevron" aria-hidden="true">
                          <i
                            className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}
                          />
                        </span>
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="teams-browse-squad" id={`team-details-${team.id}`}>
                        {team.bannerUrl ? (
                          <img
                            className="teams-browse-banner"
                            src={resolveAssetUrl(team.bannerUrl) ?? team.bannerUrl}
                            alt={team.name}
                            width={1080}
                            height={270}
                          />
                        ) : null}
                        {team.description && !canManageBranding ? (
                          <p className="text-muted small mb-3">{team.description}</p>
                        ) : null}
                        {canManageBranding ? (
                          <TeamOwnerSettings
                            key={`owner-settings-girls-${team.id}`}
                            teamId={team.id}
                            slug="girls"
                            variant="inline"
                            initialTeam={{
                              name: team.name,
                              description: team.description,
                              logoUrl: team.logoUrl,
                              customLogoUrl: team.customLogoUrl,
                              logoPosition: team.logoPosition,
                              bannerUrl: team.bannerUrl,
                            }}
                            onUpdated={() => void loadTeams()}
                          />
                        ) : null}
                        <TeamRegistrationActions
                          teamId={team.id}
                          teamName={team.name}
                          slug="girls"
                        />
                        {canEditSquadRoles ? (
                          <OwnerSquadRoles
                            key={team.id}
                            teamId={team.id}
                            players={players}
                            slug="girls"
                            onSaved={() => void loadTeams()}
                          />
                        ) : null}
                        {players.length === 0 ? (
                          <p className="text-muted mb-0">אין שחקניות רשומות</p>
                        ) : (
                          <div className="roster-table">
                            <div className="roster-table-head">
                              <span className="roster-col-num">#</span>
                              <span className="roster-col-player">שחקנית</span>
                              <span className="roster-col-pos">עמדה</span>
                              <span className="roster-col-stats">
                                <span>שערים</span>
                                <span>ממוצע</span>
                              </span>
                            </div>
                            <ul className="roster-player-list">
                              {visiblePlayers.map((player) => {
                                const isTopScorer =
                                  !!topScorerInTeam &&
                                  player.memberId === topScorerInTeam.memberId;
                                return (
                                  <RosterPlayerRow
                                    key={player.memberId}
                                    player={player}
                                    teamId={team.id}
                                    isTopScorer={isTopScorer}
                                    topScorerLabel="מלכת השערים של הקבוצה"
                                    openDetails={false}
                                  />
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GirlsTeams;
