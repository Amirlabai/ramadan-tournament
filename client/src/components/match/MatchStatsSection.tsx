import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMatchDisplayStatus } from '@ramadan-tournament/shared';
import { matchStatsAPI, type MatchStatsResponse } from '../../api/client';
import type { Goal, Match, Player, Team } from '../../types';
import { PlayerHeadImg } from '../PlayerHeadImg';
import Skeleton from '../skeleton/Skeleton';
import { WinChanceBar } from './WinChanceBar';

type StatRow = {
  label: string;
  a: number;
  b: number;
};

type MatchStatsSectionProps = {
  match: Match;
  team1Name: string;
  team2Name: string;
  teams?: Team[];
  /** When false, do not fetch (collapsed). */
  active: boolean;
};

function findPlayer(teams: Team[] | undefined, memberId: number): Player | undefined {
  if (!teams) return undefined;
  for (const team of teams) {
    const player = team.players?.find((p) => p.memberId === memberId);
    if (player) return player;
  }
  return undefined;
}

function findTeamId(teams: Team[] | undefined, memberId: number): number | undefined {
  if (!teams) return undefined;
  for (const team of teams) {
    if (team.players?.some((p) => p.memberId === memberId)) return team.id;
  }
  return undefined;
}

type ScorerSide = 'a' | 'b' | 'other';

function uniqueScorers(
  goals: Goal[],
  team1Id: number,
  team2Id: number,
  teams?: Team[]
): { memberId: number; count: number; teamId?: number; side: ScorerSide | null }[] {
  const counts = new Map<number, number>();
  for (const goal of goals) {
    if (goal.isOwnGoal || goal.memberId == null) continue;
    counts.set(goal.memberId, (counts.get(goal.memberId) || 0) + 1);
  }
  const sideOrder: Record<ScorerSide, number> = { a: 0, b: 1, other: 2 };
  return [...counts.entries()]
    .map(([memberId, count]) => {
      const teamId = findTeamId(teams, memberId);
      // Omit side until roster resolves — avoid painting everyone muted
      const side: ScorerSide | null =
        teamId == null
          ? null
          : teamId === team1Id
            ? 'a'
            : teamId === team2Id
              ? 'b'
              : 'other';
      return { memberId, count, teamId, side };
    })
    .sort((x, y) => {
      const ox = x.side == null ? 2 : sideOrder[x.side];
      const oy = y.side == null ? 2 : sideOrder[y.side];
      return ox - oy || y.count - x.count || x.memberId - y.memberId;
    });
}

function StatsSkeleton({ upcoming }: { upcoming?: boolean }) {
  return (
    <div className="match-stats-section match-stats-section--loading" role="status">
      <h3 className="match-stats-heading">סטטיסטיקה</h3>
      <span className="visually-hidden">טוען סטטיסטיקה…</span>
      <Skeleton height="0.75rem" width="100%" className="match-stats-skel-bar" rounded />
      {!upcoming ? (
        <>
          <Skeleton height="0.65rem" width="100%" className="match-stats-skel-bar" rounded />
          <div className="match-stats-skel-rows">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height="1rem" width="100%" />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function MatchStatsSection({
  match,
  team1Name,
  team2Name,
  teams,
  active,
}: MatchStatsSectionProps) {
  const [payload, setPayload] = useState<MatchStatsResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const identityRef = useRef('');

  const status = getMatchDisplayStatus(
    match.date,
    new Date(clock),
    match.technicalWinnerTeamId
  );
  const identityKey = `${match.id}:${status}`;

  // Kickoff flip while expand stays open — re-arm until past kickoff (handles 24.8d clamp)
  useEffect(() => {
    if (!active || match.technicalWinnerTeamId != null) return;
    const kickoff = new Date(match.date).getTime();
    if (!Number.isFinite(kickoff)) return;
    const delay = kickoff - Date.now();
    if (delay <= 0) return;
    const t = window.setTimeout(() => setClock(Date.now()), Math.min(delay + 300, 2_147_483_647));
    return () => window.clearTimeout(t);
  }, [active, match.date, match.technicalWinnerTeamId, clock]);

  useEffect(() => {
    if (!active || match.technicalWinnerTeamId != null) {
      setPayload(null);
      setError('');
      setLoading(false);
      identityRef.current = '';
      return;
    }

    let cancelled = false;
    const identityChanged = identityRef.current !== identityKey;
    identityRef.current = identityKey;

    // Clear only on match/status change — keep prior payload during live score refreshes
    if (identityChanged) {
      setPayload(null);
      setError('');
    }

    const load = async (background = false) => {
      try {
        if (!background) {
          setLoading(true);
          setError('');
        }
        const res = await matchStatsAPI.get(match.id);
        if (!cancelled) {
          setPayload(res.data);
          setError('');
        }
      } catch {
        if (!cancelled && !background) {
          setPayload(null);
          setError(
            status === 'upcoming'
              ? 'הערכה לפי נתונים תופיע כשהנתונים יהיו זמינים'
              : 'לא ניתן לטעון סטטיסטיקה כרגע'
          );
        }
      } finally {
        if (!cancelled && !background) setLoading(false);
      }
    };

    void load(!identityChanged);

    if (status === 'live') {
      const timer = window.setInterval(() => {
        void load(true);
      }, 30_000);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [active, match.id, match.score1, match.score2, match.technicalWinnerTeamId, status, identityKey]);

  if (match.technicalWinnerTeamId != null) {
    return (
      <div className="match-stats-section" role="region" aria-label="סטטיסטיקת משחק">
        <h3 className="match-stats-heading">סטטיסטיקה</h3>
        <p className="match-stats-empty">
          במשחק עם ניצחון טכני אין נתוני משחק להצגה (שערים, בעיטות וכו׳).
        </p>
      </div>
    );
  }

  if (loading && !payload) {
    return <StatsSkeleton upcoming={status === 'upcoming'} />;
  }

  if (error || !payload) {
    return (
      <div className="match-stats-section" role="region" aria-label="סטטיסטיקת משחק">
        <h3 className="match-stats-heading">סטטיסטיקה</h3>
        <p className="match-stats-empty">
          {error ||
            (status === 'upcoming'
              ? 'הערכה לפי נתונים תופיע כשהנתונים יהיו זמינים'
              : 'עדיין אין נתוני משחק להצגה. אפשר לבדוק שוב מאוחר יותר או לעבור לטבלה בסטטיסטיקה.')}
        </p>
      </div>
    );
  }

  const { stats, winChance, status: statsStatus } = payload;
  const chance = winChance ?? { a: 50, b: 50 };
  const showWinChance = statsStatus === 'live' || statsStatus === 'upcoming';
  const showFullStats = statsStatus === 'live' || statsStatus === 'finished';

  const rows: StatRow[] = showFullStats
    ? [
        { label: 'בעיטות', a: stats.shots.a, b: stats.shots.b },
        { label: 'למסגרת', a: stats.shotsOnTarget.a, b: stats.shotsOnTarget.b },
        { label: 'מחוץ למסגרת', a: stats.shotsOffTarget.a, b: stats.shotsOffTarget.b },
        { label: 'קרנות', a: stats.corners.a, b: stats.corners.b },
        { label: 'עבירות', a: stats.fouls.a, b: stats.fouls.b },
        { label: 'נבדלים', a: stats.offsides.a, b: stats.offsides.b },
        { label: 'הצגות שוער', a: stats.saves.a, b: stats.saves.b },
      ]
    : [];

  const scorers = showFullStats
    ? uniqueScorers(match.goals || [], match.team1Id, match.team2Id, teams)
    : [];

  return (
    <div className="match-stats-section" role="region" aria-label="סטטיסטיקת משחק">
      <h3 className="match-stats-heading">סטטיסטיקה</h3>
      {showWinChance ? (
        <WinChanceBar chance={chance} team1Name={team1Name} team2Name={team2Name} />
      ) : null}

      {showFullStats ? (
        <>
          <div
            className="match-stats-possession"
            role="group"
            aria-label={`החזקה ${stats.possession.a}% ל${team1Name}, ${stats.possession.b}% ל${team2Name}`}
          >
            <div className="match-stats-possession-labels">
              <span>
                {team1Name} {stats.possession.a}%
              </span>
              <span>החזקה</span>
              <span>
                {stats.possession.b}% {team2Name}
              </span>
            </div>
            <div className="match-stats-possession-bar" aria-hidden="true">
              <div
                className="match-stats-possession-fill match-stats-possession-fill--a"
                style={{ width: `${stats.possession.a}%` }}
              />
              <div
                className="match-stats-possession-fill match-stats-possession-fill--b"
                style={{ width: `${stats.possession.b}%` }}
              />
            </div>
          </div>

          <ul className="match-stats-rows">
            {rows.map((row) => (
              <li key={row.label} className="match-stats-row">
                <span className="match-stats-val">{row.a}</span>
                <span className="match-stats-label">{row.label}</span>
                <span className="match-stats-val">{row.b}</span>
              </li>
            ))}
          </ul>

          <div className="match-stats-players" aria-label="כובשים">
            <h4 className="match-stats-players-title">כובשים</h4>
            {scorers.length === 0 ? (
              <p className="match-stats-empty">אין כובשים במשחק זה</p>
            ) : (
              <ul className="match-stats-player-list">
                {scorers.map(({ memberId, count, teamId, side }) => {
                  const player = findPlayer(teams, memberId);
                  const nickname =
                    player?.nickname ||
                    (player ? `${player.firstName} ${player.lastName}`.trim() : `שחקן ${memberId}`);
                  const headPlayer = player ?? {
                    memberId,
                    head_photo: undefined,
                    isTeamOwner: false,
                    isCaptain: false,
                    squadRole: null,
                    position: '',
                  };
                  return (
                    <li key={memberId} className="match-stats-player-card">
                      <Link
                        to="/teams"
                        state={{ expandTeamId: teamId }}
                        className="match-stats-player-link"
                        onClick={(e) => {
                          if (!teamId) e.preventDefault();
                        }}
                      >
                        <PlayerHeadImg
                          player={headPlayer}
                          alt=""
                          className={
                            side
                              ? `match-stats-player-head match-stats-player-head--${side}`
                              : 'match-stats-player-head'
                          }
                        />
                        <span className="match-stats-player-name">
                          {nickname}
                          {count > 1 ? ` ×${count}` : ''}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="match-stats-ai-footnote">
            <span className="match-stats-ai-star" aria-hidden="true">
              ★
            </span>
            {'נתונים סטטיסטים נוצרו ע"י בינה מלאכותית'}
          </p>
        </>
      ) : (
        <p className="match-stats-upcoming-note">
          סטטיסטיקת משחק מלאה תופיע עם שריקת הפתיחה
        </p>
      )}
    </div>
  );
}
