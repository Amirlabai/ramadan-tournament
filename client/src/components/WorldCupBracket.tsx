import type { Match } from '../types';
import { filterDisplayableKnockoutMatches } from '../utils/worldCupKnockout';
import { wcStageLabel } from '../utils/worldCupLocale';
import './PlayoffBracket.css';

const STAGE_ORDER = [
  'LAST_64',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
];

interface WorldCupBracketProps {
  matches: Match[];
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
}

function stageLabel(stage?: string) {
  return wcStageLabel(stage);
}

const WorldCupBracket = ({ matches }: WorldCupBracketProps) => {
  const knockout = filterDisplayableKnockoutMatches(matches);
  if (knockout.length === 0) return null;

  const byStage = new Map<string, Match[]>();
  for (const m of knockout) {
    const key = m.stage || 'KNOCKOUT';
    const list = byStage.get(key) || [];
    list.push(m);
    byStage.set(key, list);
  }

  const stages = [...byStage.keys()].sort(
    (a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b)
  );

  return (
    <section className="playoff-bracket wc-bracket mb-3" aria-labelledby="wc-bracket-title">
      <h3 id="wc-bracket-title" className="playoff-bracket-title">
        שלב הנוקאאוט
      </h3>
      <div className="wc-bracket-stages">
        {stages.map((stage) => (
          <div key={stage} className="wc-bracket-stage card p-2 mb-2">
            <h4 className="h6 fw-bold mb-2">{stageLabel(stage)}</h4>
            <ul className="list-unstyled mb-0">
              {(byStage.get(stage) || []).map((match) => (
                <li key={match._id} className="wc-bracket-match mb-2 pb-2 border-bottom">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span className="d-flex align-items-center gap-2">
                      {match.team1LogoUrl && (
                        <img
                          src={match.team1LogoUrl}
                          alt=""
                          className="team-logo-inline"
                          style={{ width: 24, height: 24 }}
                        />
                      )}
                      {match.team1Name || `קבוצה ${match.team1Id}`}
                    </span>
                    <span className="fw-bold">
                      {match.score1 != null && match.score2 != null
                        ? `${match.score1} - ${match.score2}`
                        : 'VS'}
                    </span>
                    <span className="d-flex align-items-center gap-2">
                      {match.team2LogoUrl && (
                        <img
                          src={match.team2LogoUrl}
                          alt=""
                          className="team-logo-inline"
                          style={{ width: 24, height: 24 }}
                        />
                      )}
                      {match.team2Name || `קבוצה ${match.team2Id}`}
                    </span>
                  </div>
                  <div className="small text-muted mt-1">
                    {formatDate(match.date)} · {match.location}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WorldCupBracket;
