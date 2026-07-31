import React from 'react';
import type { Match } from '../types';
import { PlayoffBracketTree } from './PlayoffBracketTree';
import { PlayoffShareCard } from './share/PlayoffShareCard';
import { ShareButton } from './share/ShareButton';
import { playoffMatchesShareSnapshot } from '../utils/shareSnapshot';
import './PlayoffBracket.css';

interface PlayoffBracketProps {
  matches: Match[];
}

const PlayoffBracket: React.FC<PlayoffBracketProps> = ({ matches }) => {
  return (
    <div className="playoff-bracket-card dashboard-card mb-5">
      <div className="dashboard-card-title share-section-title">
        <h2>תרשים פלייאוף</h2>
        <ShareButton
          filename="playoff-bracket.png"
          snapshot={playoffMatchesShareSnapshot(matches)}
          title="תרשים פלייאוף"
          text="תרשים הפלייאוף בטורניר"
          className="share-button--on-primary"
          // Freeze matches at click; snapshot key already invalidates when data changes.
          prepare={async () => matches}
          renderContent={(list) => (list ? <PlayoffShareCard matches={list} /> : null)}
        />
      </div>
      <PlayoffBracketTree matches={matches} />
    </div>
  );
};

export default PlayoffBracket;
