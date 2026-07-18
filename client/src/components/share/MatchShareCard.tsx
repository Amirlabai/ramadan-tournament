import type { MatchStatsResponse } from '../../api/client';
import type { Match, Player, Team } from '../../types';
import { MatchTeamsScore, type MatchDisplayStatus } from '../match/MatchCardParts';
import { SharePlayerHead } from './SharePlayerHead';

type MatchShareCardProps = {
  match: Match;
  status: MatchDisplayStatus;
  team1Name: string;
  team2Name: string;
  team1Logo?: string;
  team2Logo?: string;
  teams: Team[];
  stats: MatchStatsResponse | null;
};

const STAT_ROWS: { key: keyof MatchStatsResponse['stats']; label: string }[] = [
  { key: 'shots', label: 'בעיטות' },
  { key: 'shotsOnTarget', label: 'למסגרת' },
  { key: 'shotsOffTarget', label: 'מחוץ למסגרת' },
  { key: 'corners', label: 'קרנות' },
  { key: 'fouls', label: 'עבירות' },
  { key: 'offsides', label: 'נבדלים' },
  { key: 'saves', label: 'הצלות שוער' },
];

const STATUS_TITLES: Record<MatchDisplayStatus, string> = {
  upcoming: 'משחק קרוב',
  live: 'משחק חי',
  finished: 'סיכום משחק',
};

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(dateString));
}

function findPlayer(teams: Team[], memberId: number): Player | undefined {
  for (const team of teams) {
    const player = team.players?.find((candidate) => candidate.memberId === memberId);
    if (player) return player;
  }
  return undefined;
}

function scorerRows(match: Match, teams: Team[]) {
  const counts = new Map<number, number>();
  for (const goal of match.goals ?? []) {
    if (goal.isOwnGoal || goal.memberId == null) continue;
    counts.set(goal.memberId, (counts.get(goal.memberId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([memberId, count]) => ({
    memberId,
    count,
    player: findPlayer(teams, memberId),
  }));
}

export function MatchShareCard({
  match,
  status,
  team1Name,
  team2Name,
  team1Logo,
  team2Logo,
  teams,
  stats,
}: MatchShareCardProps) {
  const scorers = scorerRows(match, teams);
  const showStats = status !== 'upcoming' && match.technicalWinnerTeamId == null;
  const title =
    match.phase === 'knockout' && status === 'finished'
      ? 'סיכום פלייאוף'
      : STATUS_TITLES[status];

  return (
    <article className="share-card share-match-card">
      <header className="share-card__header">
        <h1>{title}</h1>
      </header>

      <div className="share-match-card__score">
        <MatchTeamsScore
          team1Name={team1Name}
          team2Name={team2Name}
          score1={match.score1}
          score2={match.score2}
          showScores={status !== 'upcoming'}
          team1OnRight
          team1Winner={match.technicalWinnerTeamId === match.team1Id}
          team2Winner={match.technicalWinnerTeamId === match.team2Id}
          team1Logo={
            team1Logo ? <img src={team1Logo} alt="" className="team-logo-inline" /> : undefined
          }
          team2Logo={
            team2Logo ? <img src={team2Logo} alt="" className="team-logo-inline" /> : undefined
          }
        />
      </div>

      <div className="share-match-card__meta">
        <span><strong>מועד:</strong> {formatDate(match.date)}</span>
        <span><strong>מיקום:</strong> {match.location}</span>
      </div>

      {match.technicalWinnerTeamId != null ? (
        <p className="share-match-card__technical">ניצחון טכני</p>
      ) : null}

      {showStats && stats ? (
        <section className="share-match-stats">
          <h2>סטטיסטיקת המשחק</h2>
          <div className="share-possession">
            <div className="share-possession__labels">
              <strong>{stats.stats.possession.a}%</strong>
              <span>החזקה בכדור</span>
              <strong>{stats.stats.possession.b}%</strong>
            </div>
            <div className="share-possession__bar">
              <span style={{ width: `${stats.stats.possession.a}%` }} />
              <span style={{ width: `${stats.stats.possession.b}%` }} />
            </div>
          </div>

          <ul className="share-stat-rows">
            {STAT_ROWS.map(({ key, label }) => (
              <li key={key}>
                <strong>{stats.stats[key].a}</strong>
                <span>{label}</span>
                <strong>{stats.stats[key].b}</strong>
              </li>
            ))}
          </ul>

          <div className="share-scorers">
            <h3>כובשים</h3>
            {scorers.length ? (
              <ul>
                {scorers.map(({ memberId, count, player }) => (
                  <li key={memberId}>
                    <SharePlayerHead
                      player={
                        player ?? {
                          memberId,
                          head_photo: undefined,
                          isTeamOwner: false,
                          isCaptain: false,
                          squadRole: null,
                          position: '',
                        }
                      }
                    />
                    <span>
                      {player?.nickname ||
                        (player
                          ? `${player.firstName} ${player.lastName}`.trim()
                          : `שחקן ${memberId}`)}
                      {count > 1 ? ` ×${count}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>אין כובשים במשחק זה</p>
            )}
          </div>
        </section>
      ) : showStats ? (
        <p className="share-match-card__stats-unavailable">
          סטטיסטיקת המשחק אינה זמינה כרגע
        </p>
      ) : null}
    </article>
  );
}
