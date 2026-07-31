import type { Match } from '../../types';
import { PlayoffBracketTree } from '../PlayoffBracketTree';
import '../PlayoffBracket.css';

type PlayoffShareCardProps = {
  matches: Match[];
};

export function PlayoffShareCard({ matches }: PlayoffShareCardProps) {
  return (
    <article className="share-card share-playoff-card playoff-bracket-card">
      <header className="share-card__header">
        <h1>תרשים פלייאוף</h1>
      </header>
      <PlayoffBracketTree matches={matches} />
    </article>
  );
}
