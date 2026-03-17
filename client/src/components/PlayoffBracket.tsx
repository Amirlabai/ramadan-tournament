import React from 'react';
import type { Match } from '../types';
import './PlayoffBracket.css';

interface PlayoffBracketProps {
    matches: Match[];
}

const PlayoffBracket: React.FC<PlayoffBracketProps> = ({ matches }) => {
    // Organize matches by bracket and type
    const winnersSemi1 = matches.find(m => m.id === 1004);
    const winnersSemi2 = matches.find(m => m.id === 1003);
    const winnersFinal = matches.find(m => m.id === 2002);

    const losersSemi1 = matches.find(m => m.id === 1001);
    const losersSemi2 = matches.find(m => m.id === 1002);
    const losersFinal = matches.find(m => m.id === 2001);

    const renderMatch = (match?: Match, label?: string) => {
        if (!match) return null;

        const score1 = match.score1 ?? '-';
        const score2 = match.score2 ?? '-';

        return (
            <div className="bracket-match">
                {label && <div className="match-label">{label}</div>}
                <div className="match-teams">
                    <div className="team-row">
                        <span className="team-name">{match.team1Name || `מקום ${match.id === 1004 ? 1 : match.id === 1003 ? 2 : match.id === 1001 ? 5 : 6}`}</span>
                        <span className="team-score">{score1}</span>
                    </div>
                    <div className="team-row">
                        <span className="team-name">{match.team2Name || `מקום ${match.id === 1004 ? 4 : match.id === 1003 ? 3 : match.id === 1001 ? 8 : 7}`}</span>
                        <span className="team-score">{score2}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="playoff-bracket-card dashboard-card mb-5">
            <h2>תרשים פלייאוף</h2>
            <div className="brackets-wrapper">
                {/* Winners Bracket (Right) */}
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
                        <div className="bracket-column final">
                            {renderMatch(winnersFinal, 'גמר עליון')}
                        </div>
                    </div>
                </div>

                {/* Losers Bracket (Left) */}
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
                        <div className="bracket-column final">
                            {renderMatch(losersFinal, 'גמר תחתון')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayoffBracket;
