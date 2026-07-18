import type { TopScorer } from '../../types';
import { toHeadPlayer } from '../../utils/toHeadPlayer';
import { SharePlayerHead } from './SharePlayerHead';

type TopScorersShareCardProps = {
  scorers: TopScorer[];
  limit: number;
};

export function TopScorersShareCard({ scorers, limit }: TopScorersShareCardProps) {
  const visibleScorers = scorers.slice(0, limit);

  return (
    <article className="share-card share-scorers-card">
      <header className="share-card__header">
        <h1>מלכי השערים</h1>
      </header>

      {visibleScorers.length ? (
        <ol className={`share-scorers-list${limit <= 3 ? ' share-scorers-list--podium' : ''}`}>
          {visibleScorers.map((scorer, index) => (
            <li key={scorer.memberId} className={index === 0 ? 'is-leader' : undefined}>
              <span className="share-scorer-rank">{index + 1}</span>
              <SharePlayerHead
                player={toHeadPlayer(scorer)}
                className="share-scorer-head"
              />
              <span className="share-scorer-identity">
                <strong>{scorer.playerName}</strong>
                <span>{scorer.teamName}</span>
              </span>
              <span className="share-scorer-goals">
                <strong>{scorer.goals}</strong>
                <span>שערים</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="share-card__empty">אין נתוני כובשים להצגה</p>
      )}
    </article>
  );
}
