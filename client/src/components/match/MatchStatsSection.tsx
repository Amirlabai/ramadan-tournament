import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMatchDisplayStatus } from '@ramadan-tournament/shared';
import { matchStatsAPI, type MatchStatsResponse } from '../../api/client';
import type { Goal, Match, Player, Team } from '../../types';
import { PlayerHeadImg } from '../PlayerHeadImg';

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

function uniqueScorers(goals: Goal[]): { memberId: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const goal of goals) {
    if (goal.isOwnGoal || goal.memberId == null) continue;
    counts.set(goal.memberId, (counts.get(goal.memberId) || 0) + 1);
  }
  return [...counts.entries()].map(([memberId, count]) => ({ memberId, count }));
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

  const status = getMatchDisplayStatus(
    match.date,
    new Date(),
    match.technicalWinnerTeamId
  );

  useEffect(() => {
    if (!active || status === 'upcoming' || match.technicalWinnerTeamId != null) {
      return;
    }

    let cancelled = false;

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
          setError('לא ניתן לטעון סטטיסטיקה כרגע');
        }
      } finally {
        if (!cancelled && !background) setLoading(false);
      }
    };

    void load(false);

    if (status !== 'live') {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(() => {
      void load(true);
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, match.id, match.score1, match.score2, match.technicalWinnerTeamId, status]);

  if (match.technicalWinnerTeamId != null) {
    return (
      <div className="match-stats-section" role="region" aria-label="סטטיסטיקת משחק">
        <p className="match-stats-empty">אין סטטיסטיקה למשחק עם ניצחון טכני</p>
      </div>
    );
  }

  if (status === 'upcoming') {
    return (
      <div className="match-stats-section" role="region" aria-label="סטטיסטיקת משחק">
        <p className="match-stats-empty">סטטיסטיקה תופיע עם שריקת הפתיחה</p>
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="match-stats-section" role="status">
        <p className="match-stats-empty">טוען סטטיסטיקה…</p>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="match-stats-section" role="region" aria-label="סטטיסטיקת משחק">
        <p className="match-stats-empty">{error || 'אין סטטיסטיקה זמינה'}</p>
      </div>
    );
  }

  const { stats, winChance, status: statsStatus } = payload;
  const chance = winChance ?? { a: 50, b: 50 };
  const showWinChance = statsStatus === 'live';
  const rows: StatRow[] = [
    { label: 'בעיטות', a: stats.shots.a, b: stats.shots.b },
    { label: 'למסגרת', a: stats.shotsOnTarget.a, b: stats.shotsOnTarget.b },
    { label: 'מחוץ למסגרת', a: stats.shotsOffTarget.a, b: stats.shotsOffTarget.b },
    { label: 'קרנות', a: stats.corners.a, b: stats.corners.b },
    { label: 'עבירות', a: stats.fouls.a, b: stats.fouls.b },
    { label: 'נבדלים', a: stats.offsides.a, b: stats.offsides.b },
    { label: 'הצגות שוער', a: stats.saves.a, b: stats.saves.b },
  ];

  const scorers = uniqueScorers(match.goals || []);

  return (
    <div className="match-stats-section" role="region" aria-label="סטטיסטיקת משחק">
      {showWinChance && (
      <div
        className="match-stats-winchance"
        role="group"
        aria-label={`הערכת יתרון: ${chance.a}% ל${team1Name}, ${chance.b}% ל${team2Name}`}
      >
        <div className="match-stats-winchance-labels">
          <span>
            {team1Name} {chance.a}%
          </span>
          <span>סיכוי לניצחון</span>
          <span>
            {chance.b}% {team2Name}
          </span>
        </div>
        <div className="match-stats-winchance-bar" aria-hidden="true">
          <div
            className="match-stats-winchance-fill match-stats-winchance-fill--a"
            style={{ width: `${chance.a}%` }}
          />
          <div
            className="match-stats-winchance-fill match-stats-winchance-fill--b"
            style={{ width: `${chance.b}%` }}
          />
        </div>
      </div>
      )}

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
            {scorers.map(({ memberId, count }) => {
              const player = findPlayer(teams, memberId);
              const nickname =
                player?.nickname ||
                (player ? `${player.firstName} ${player.lastName}`.trim() : `שחקן ${memberId}`);
              const team = teams?.find((t) => t.players?.some((p) => p.memberId === memberId));
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
                    state={{ expandTeamId: team?.id }}
                    className="match-stats-player-link"
                    onClick={(e) => {
                      if (!team?.id) e.preventDefault();
                    }}
                  >
                    <PlayerHeadImg
                      player={headPlayer}
                      alt=""
                      className="match-stats-player-head"
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
        <span className="match-stats-ai-star" aria-hidden="true">★</span>
        {'נתונים סטטיסטים נוצרו ע"י בינה מלאכותית'}
      </p>
    </div>
  );
}
