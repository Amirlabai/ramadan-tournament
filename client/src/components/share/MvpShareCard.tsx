import { toHeadPlayer } from '../../utils/toHeadPlayer';
import { SharePlayerHead } from './SharePlayerHead';

/** Normalized MVP leaderboard row for share capture. */
export type MvpShareEntry = {
  memberId: number;
  playerName: string;
  teamName: string;
  votes: number;
  head_photo?: string;
  isCaptain?: boolean;
  isTeamOwner?: boolean;
  squadRole?: string;
  position?: string;
};

type MvpShareCardProps = {
  entries: MvpShareEntry[];
  limit: number;
};

export function MvpShareCard({ entries, limit }: MvpShareCardProps) {
  const visible = entries.slice(0, limit);

  return (
    <article className="share-card share-scorers-card">
      <header className="share-card__header">
        <h1>מובילי ה-MVP</h1>
      </header>

      {visible.length ? (
        <ol className="share-scorers-list">
          {visible.map((entry, index) => (
            <li key={entry.memberId} className={index === 0 ? 'is-leader' : undefined}>
              <span className="share-scorer-rank">{index + 1}</span>
              <SharePlayerHead
                player={toHeadPlayer(entry)}
                className="share-scorer-head"
              />
              <span className="share-scorer-identity">
                <strong>{entry.playerName}</strong>
                <span>{entry.teamName}</span>
              </span>
              <span className="share-scorer-goals">
                <strong>{entry.votes}</strong>
                <span>הצבעות</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="share-card__empty">אין נתוני הצבעות להצגה</p>
      )}
    </article>
  );
}
