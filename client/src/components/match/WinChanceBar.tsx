import type { MatchStatsSidePair } from '../../api/client';

type WinChanceBarProps = {
  chance: MatchStatsSidePair;
  team1Name: string;
  team2Name: string;
  className?: string;
};

export function WinChanceBar({ chance, team1Name, team2Name, className }: WinChanceBarProps) {
  const rootClass = ['match-stats-winchance', className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      role="group"
      aria-label={`הערכה משוערת לפי נתונים: ${chance.a}% ל${team1Name}, ${chance.b}% ל${team2Name}`}
    >
      <p className="match-stats-winchance-caption">הערכה לפי נתונים · תחזית משוערת</p>
      <div className="match-stats-winchance-bar" aria-hidden="true">
        <div
          className="match-stats-winchance-fill match-stats-winchance-fill--a"
          style={{ flexGrow: Math.max(chance.a, 1) }}
        >
          <strong className="match-stats-winchance-pct">
            <span className="visually-hidden">{team1Name} </span>
            {chance.a}%
          </strong>
        </div>
        <div
          className="match-stats-winchance-fill match-stats-winchance-fill--b"
          style={{ flexGrow: Math.max(chance.b, 1) }}
        >
          <strong className="match-stats-winchance-pct">
            <span className="visually-hidden">{team2Name} </span>
            {chance.b}%
          </strong>
        </div>
      </div>
    </div>
  );
}
