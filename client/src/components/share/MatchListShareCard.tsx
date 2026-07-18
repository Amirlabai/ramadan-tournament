import type { MatchStatsSidePair } from '../../api/client';
import type { Match } from '../../types';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { formatShareDate } from '../../utils/shareSnapshot';
import { MatchTeamsScore } from '../match/MatchCardParts';
import { WinChanceBar } from '../match/WinChanceBar';

export type MatchListWinChances = Record<number, MatchStatsSidePair | null>;

type MatchListShareCardProps = {
  title: string;
  matches: Match[];
  variant: 'upcoming' | 'finished';
  winChances?: MatchListWinChances | null;
};

function formatDate(dateString: string, withTime: boolean): string {
  return formatShareDate(dateString, {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    ...(withTime ? { hour: '2-digit' as const, minute: '2-digit' as const } : {}),
  });
}

function teamLogoNode(url?: string, position?: Match['team1LogoPosition']) {
  const src = position === 'none' ? undefined : resolveAssetUrl(url);
  return src ? <img src={src} alt="" className="team-logo-inline" /> : undefined;
}

export function MatchListShareCard({
  title,
  matches,
  variant,
  winChances,
}: MatchListShareCardProps) {
  return (
    <article className={`share-card share-match-list-card share-match-list-card--${variant}`}>
      <header className="share-card__header">
        <h1>{title}</h1>
      </header>

      {matches.length ? (
        <ol className="share-match-list">
          {matches.map((match) => {
            const team1Name = match.team1Name || `קבוצה ${match.team1Id}`;
            const team2Name = match.team2Name || `קבוצה ${match.team2Id}`;
            const chance = winChances?.[match.id] ?? null;
            return (
              <li key={match.id}>
                <span className="share-match-list__date">
                  {formatDate(match.date, variant === 'upcoming')}
                  {variant === 'upcoming' && match.location ? ` · ${match.location}` : ''}
                  {match.phase === 'knockout' ? (
                    <span className="share-match-list__tag">פלייאוף</span>
                  ) : null}
                  {match.technicalWinnerTeamId != null ? (
                    <span className="share-match-list__tag">ניצחון טכני</span>
                  ) : null}
                </span>
                <MatchTeamsScore
                  team1Name={team1Name}
                  team2Name={team2Name}
                  score1={match.score1}
                  score2={match.score2}
                  showScores={variant === 'finished'}
                  team1OnRight
                  team1Winner={match.technicalWinnerTeamId === match.team1Id}
                  team2Winner={match.technicalWinnerTeamId === match.team2Id}
                  team1Logo={teamLogoNode(match.team1LogoUrl, match.team1LogoPosition)}
                  team2Logo={teamLogoNode(match.team2LogoUrl, match.team2LogoPosition)}
                />
                {variant === 'upcoming' && chance ? (
                  <WinChanceBar
                    chance={chance}
                    team1Name={team1Name}
                    team2Name={team2Name}
                    className="share-match-list__winchance"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="share-card__empty">אין משחקים להצגה</p>
      )}
    </article>
  );
}
