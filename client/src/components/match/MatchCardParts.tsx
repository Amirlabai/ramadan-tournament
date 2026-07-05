import type { ReactNode } from 'react';

export type MatchDisplayStatus = 'upcoming' | 'live' | 'finished';

const STATUS_LABELS: Record<MatchDisplayStatus, string> = {
  upcoming: 'עתיד',
  live: 'Live',
  finished: 'הסתיים',
};

interface MatchStatusBadgeProps {
  status: MatchDisplayStatus;
}

export function MatchStatusBadge({ status }: MatchStatusBadgeProps) {
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
  vsLabel?: string;
}

export function MatchTeamsScore({
  team1Name,
  team2Name,
  score1,
  score2,
  showScores,
  team1Logo,
  team2Logo,
  vsLabel = 'VS',
}: MatchTeamsScoreProps) {
  return (
    <div className="match-teams-score">
      <div className="team-side">
        {team1Logo}
        <span className="team-name">{team1Name}</span>
        {showScores && <span className="team-score">{score1 ?? '—'}</span>}
      </div>
      <div className="vs-divider">{vsLabel}</div>
      <div className="team-side">
        {team2Logo}
        <span className="team-name">{team2Name}</span>
        {showScores && <span className="team-score">{score2 ?? '—'}</span>}
      </div>
    </div>
  );
}
