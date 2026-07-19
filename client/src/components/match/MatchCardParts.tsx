import type { ReactNode } from 'react';

export type MatchDisplayStatus = 'upcoming' | 'live' | 'finished';

const STATUS_LABELS: Record<MatchDisplayStatus, string> = {
  upcoming: 'עתיד',
  live: 'לייב',
  finished: 'הסתיים',
};

interface MatchStatusBadgeProps {
  status: MatchDisplayStatus;
  technical?: boolean;
}

export function MatchStatusBadge({ status, technical }: MatchStatusBadgeProps) {
  if (technical) {
    return (
      <span className="match-status finished match-status--technical">
        ניצחון טכני
      </span>
    );
  }
  return (
    <span className={`match-status ${status}`}>{STATUS_LABELS[status]}</span>
  );
}

interface MatchTeamsScoreProps {
  team1Name: string;
  team2Name: string;
  score1?: number | string | null;
  score2?: number | string | null;
  showScores: boolean;
  team1Logo?: ReactNode;
  team2Logo?: ReactNode;
  team1Winner?: boolean;
  team2Winner?: boolean;
  vsLabel?: string;
  /**
   * When true, team1 sits on the right under WinChanceBar fill--a (team1 / chance.a /
   * --color-primary); team2 sits left under fill--b (chance.b / --color-secondary).
   */
  team1OnRight?: boolean;
}

/**
 * Default LTR: team1 left | VS | team2 right.
 * With team1OnRight: team2 left | VS | team1 right (matches RTL win-chance a/b sides).
 */
export function MatchTeamsScore({
  team1Name,
  team2Name,
  score1,
  score2,
  showScores,
  team1Logo,
  team2Logo,
  team1Winner,
  team2Winner,
  vsLabel = 'VS',
  team1OnRight = false,
}: MatchTeamsScoreProps) {
  return (
    <div className="match-teams-score" dir={team1OnRight ? 'rtl' : 'ltr'}>
      <div
        className={`team-side team-side--home${team1Winner ? ' team-side--winner' : ''}`}
      >
        {team1Logo ? <span className="team-logo-slot">{team1Logo}</span> : null}
        <span className="team-name">{team1Name}</span>
      </div>

      <div className="match-scoreline" aria-hidden={!showScores}>
        {showScores ? (
          <span className="team-score">{score1 ?? '-'}</span>
        ) : null}
        <span className="vs-divider">{vsLabel}</span>
        {showScores ? (
          <span className="team-score">{score2 ?? '-'}</span>
        ) : null}
      </div>

      <div
        className={`team-side team-side--away${team2Winner ? ' team-side--winner' : ''}`}
      >
        <span className="team-name">{team2Name}</span>
        {team2Logo ? <span className="team-logo-slot">{team2Logo}</span> : null}
      </div>
    </div>
  );
}
