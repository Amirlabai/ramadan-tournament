import {
  LOWER_FINAL_ID,
  LOWER_SEMI_IDS,
  UPPER_FINAL_ID,
  UPPER_SEMI_IDS,
} from '@ramadan-tournament/shared';
import type { Match } from '../types';

const PLACEHOLDER_SLOTS: Record<number, [number, number]> = {
  [UPPER_SEMI_IDS.firstVsFourth]: [1, 4],
  [UPPER_SEMI_IDS.secondVsThird]: [2, 3],
  [LOWER_SEMI_IDS.fifthVsEighth]: [5, 8],
  [LOWER_SEMI_IDS.sixthVsSeventh]: [6, 7],
};

function placeholderTeam(matchId: number, side: 1 | 2): string {
  const pair = PLACEHOLDER_SLOTS[matchId];
  return pair ? `מקום ${pair[side - 1]}` : 'טרם נקבע';
}

function renderMatch(match?: Match, label?: string) {
  if (!match) return null;

  const score1 = match.score1 ?? '-';
  const score2 = match.score2 ?? '-';

  return (
    <div className="bracket-match">
      {label ? <div className="match-label">{label}</div> : null}
      <div className="match-teams">
        <div className="team-row">
          <span className="team-name">
            {match.team1Name || placeholderTeam(match.id, 1)}
          </span>
          <span className="team-score">{score1}</span>
        </div>
        <div className="team-row">
          <span className="team-name">
            {match.team2Name || placeholderTeam(match.id, 2)}
          </span>
          <span className="team-score">{score2}</span>
        </div>
      </div>
    </div>
  );
}

/** Shared flowchart body for page + share PNG. */
export function PlayoffBracketTree({ matches }: { matches: Match[] }) {
  const winnersSemi1 = matches.find((m) => m.id === UPPER_SEMI_IDS.firstVsFourth);
  const winnersSemi2 = matches.find((m) => m.id === UPPER_SEMI_IDS.secondVsThird);
  const winnersFinal = matches.find((m) => m.id === UPPER_FINAL_ID);
  const losersSemi1 = matches.find((m) => m.id === LOWER_SEMI_IDS.fifthVsEighth);
  const losersSemi2 = matches.find((m) => m.id === LOWER_SEMI_IDS.sixthVsSeventh);
  const losersFinal = matches.find((m) => m.id === LOWER_FINAL_ID);

  return (
    <div className="brackets-wrapper">
      <div className="bracket winners-bracket">
        <h4 className="bracket-title">פלייאוף עליון</h4>
        <div className="bracket-content">
          <div className="bracket-column semis">
            {renderMatch(winnersSemi1, 'חצי גמר 1')}
            {renderMatch(winnersSemi2, 'חצי גמר 2')}
          </div>
          <div className="bracket-connector">
            <div className="line line-top"></div>
            <div className="line line-bottom"></div>
          </div>
          <div className="bracket-column final">{renderMatch(winnersFinal, 'גמר עליון')}</div>
        </div>
      </div>

      <div className="bracket losers-bracket">
        <h4 className="bracket-title">פלייאוף תחתון</h4>
        <div className="bracket-content">
          <div className="bracket-column semis">
            {renderMatch(losersSemi1, 'חצי גמר 1')}
            {renderMatch(losersSemi2, 'חצי גמר 2')}
          </div>
          <div className="bracket-connector">
            <div className="line line-top"></div>
            <div className="line line-bottom"></div>
          </div>
          <div className="bracket-column final">{renderMatch(losersFinal, 'גמר תחתון')}</div>
        </div>
      </div>
    </div>
  );
}
