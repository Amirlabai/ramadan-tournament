import type { Team } from '../../types';
import { displayNickname, fullName } from '../../utils/playerDisplayName';
import { sortRosterPlayers } from '../../utils/rosterSort';
import { SharePlayerHead } from './SharePlayerHead';

type TeamShareCardProps = {
  team: Team;
  logoSrc?: string;
};

export function TeamShareCard({ team, logoSrc }: TeamShareCardProps) {
  const players = sortRosterPlayers(team.players ?? []);
  const captain = players.find((player) => player.isCaptain);

  return (
    <article className="share-card share-team-card">
      <header className="share-team-card__header">
        {logoSrc ? <img src={logoSrc} alt="" className="share-team-card__crest" /> : null}
        <div>
          <h1>{team.name}</h1>
          <span>
            {players.length} שחקנים
            {captain ? ` · קפטן: ${fullName(captain)}` : ''}
          </span>
        </div>
      </header>

      {team.description ? <p className="share-team-card__description">{team.description}</p> : null}

      {players.length ? (
        <ol className="share-team-roster">
          {players.map((player) => (
            <li key={player.memberId}>
              <span className="share-team-roster__number">{player.number}</span>
              <SharePlayerHead player={player} className="share-team-roster__head" />
              <span className="share-team-roster__identity">
                <strong>{displayNickname(player)}</strong>
                <span>{fullName(player)}</span>
              </span>
              <span className="share-team-roster__position">
                {player.isCaptain ? 'קפטן · ' : ''}
                {player.position || 'שחקן'}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="share-card__empty">אין שחקנים רשומים</p>
      )}
    </article>
  );
}
