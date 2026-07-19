import { PlayerHeadImg } from '../PlayerHeadImg';
import type { Player } from '../../types';
import { displayNickname, fullName } from '../../utils/playerDisplayName';
import { displayOrDash } from '@ramadan-tournament/shared';

interface RosterPlayerRowProps {
  player: Player;
  teamId: number;
  isTopScorer?: boolean;
  /** Hebrew top-scorer role label (boys default). */
  topScorerLabel?: string;
  selected?: boolean;
  showVote?: boolean;
  myVoteMemberId?: number | null;
  isVoting?: boolean;
  openDetails?: boolean;
  onVote?: (player: Player & { teamId: number }, e: React.MouseEvent) => void;
  onOpen?: (player: Player & { teamId: number }) => void;
}

export default function RosterPlayerRow({
  player,
  teamId,
  isTopScorer = false,
  topScorerLabel = 'מלך השערים של הקבוצה',
  selected = false,
  showVote = false,
  myVoteMemberId = null,
  isVoting = false,
  openDetails = true,
  onVote,
  onOpen,
}: RosterPlayerRowProps) {
  const goals = player.totalGoals || 0;
  const avg =
    player.totalGoals && player.gamesPlayed
      ? (player.totalGoals / player.gamesPlayed).toFixed(2)
      : '0.00';
  const voted = myVoteMemberId === player.memberId;
  const clickable = openDetails && !!onOpen;
  const voteEnabled = !!(showVote && onVote);
  const isCaptain = !!player.isCaptain;
  const isOwner = !!player.isTeamOwner;
  const hasNumber = player.number > 0;
  const positionDisplay = displayOrDash(player.position);
  const positionLabel = positionDisplay === '-' ? undefined : positionDisplay;
  const mainClass = `roster-player-row-main${clickable ? '' : ' roster-player-row-main--static'}`;
  const rowClass = [
    'roster-player-row',
    voteEnabled ? 'roster-player-row--vote' : '',
    isTopScorer ? 'top-scorer-highlight' : '',
    selected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const roleBits = [
    isTopScorer ? topScorerLabel : '',
    isCaptain ? 'קפטן' : '',
    isOwner ? 'בעלים' : '',
  ].filter(Boolean);
  const roleText = roleBits.join(', ');
  const rolesId = roleText ? `player-roles-${player.memberId}` : undefined;

  const identity = (
    <>
      <span className="roster-player-row-photo" aria-hidden="true">
        <PlayerHeadImg player={player} alt="" className="roster-player-row-photo-img" />
        {isTopScorer ? (
          <span className="roster-player-row-top-scorer">⚽</span>
        ) : null}
        {isCaptain ? (
          <span className="roster-player-row-role-badge roster-player-row-role-badge--captain">
            C
          </span>
        ) : null}
        {isOwner ? (
          <span className="roster-player-row-role-badge roster-player-row-role-badge--owner">
            O
          </span>
        ) : null}
      </span>
      <span className="roster-player-row-body">
        <span className="roster-player-row-nick">{displayNickname(player)}</span>
        <span className="roster-player-row-fullname" dir="auto">
          {fullName(player)}
        </span>
        {positionLabel ? (
          <span className="roster-player-row-pos-inline">{positionLabel}</span>
        ) : null}
        {roleText ? (
          <span id={rolesId} className="visually-hidden">
            {roleText}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <li
      id={`player-card-${player.memberId}`}
      className={rowClass}
      aria-describedby={clickable ? undefined : rolesId}
    >
      {voteEnabled ? (
        <button
          type="button"
          onClick={(e) => onVote!({ ...player, teamId }, e)}
          className="btn btn-sm border-0 bg-transparent roster-player-row-vote p-0"
          aria-label={
            voted
              ? `בטל הצבעה ל${fullName(player)}`
              : `הצבע ל${fullName(player)} כמצטיין`
          }
          aria-pressed={voted}
          disabled={isVoting}
        >
          <i
            className={`fs-5 ${voted ? 'text-warning fa-solid fa-star' : 'text-secondary fa-regular fa-star'}`}
            aria-hidden="true"
          />
        </button>
      ) : null}

      <span
        className="roster-player-row-num"
        aria-label={hasNumber ? `מספר ${player.number}` : 'ללא מספר'}
      >
        {hasNumber ? player.number : '-'}
      </span>

      {clickable ? (
        <button
          type="button"
          className={mainClass}
          onClick={() => onOpen!({ ...player, teamId })}
          aria-label={`פרטי שחקן ${fullName(player)}`}
          aria-describedby={rolesId}
        >
          {identity}
        </button>
      ) : (
        <div className={mainClass}>{identity}</div>
      )}

      <span className="roster-player-row-pos" title={positionLabel}>
        {positionDisplay}
      </span>

      <div className="roster-player-row-stats">
        <span className="roster-player-row-stat" title="שערים">
          {goals}
        </span>
        <span className="roster-player-row-stat" title="ממוצע שערים למשחק">
          {avg}
        </span>
      </div>
    </li>
  );
}
