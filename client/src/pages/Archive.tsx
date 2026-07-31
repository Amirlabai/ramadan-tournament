import React, { useState, useEffect } from 'react';
import { STANDINGS_PLAYOFF_ZONE_SIZE, displayOrDash } from '@ramadan-tournament/shared';
import { archiveAPI } from '../api/client';
import SEO from '../components/SEO';
import { ArchiveSkeleton } from '../components/skeleton';
import { useMinSkeletonTime } from '../hooks/useMinSkeletonTime';
import './Archive.css';

interface SeasonMetadata {
  id: string;
  yearMonth: string;
  displayName: string;
  winner: {
    name: string;
    logoUrl?: string;
  };
  topScorer: {
    name: string;
    goals: number;
  };
}

const Archive: React.FC = () => {
  const [seasons, setSeasons] = useState<SeasonMetadata[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      const res = await archiveAPI.getAll();
      setSeasons(res.data);
      if (res.data.length > 0) {
        fetchSeasonDetail(res.data[0].yearMonth);
      }
    } catch (err: any) {
      setError('שגיאה בטעינת היסטוריה');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasonDetail = async (yearMonth: string) => {
    setLoading(true);
    try {
      const res = await archiveAPI.getById(yearMonth);
      setSelectedSeason(res.data);
    } catch (err: any) {
      setError('שגיאה בטעינת נתוני העונה');
    } finally {
      setLoading(false);
    }
  };

  const showSkeleton = useMinSkeletonTime(loading && !selectedSeason, { error });

  if (showSkeleton) {
    return <ArchiveSkeleton label="טוען ארכיון..." />;
  }

  return (
    <div className="archive-page container py-4 animate-fade-in">
      <SEO pathname="/archive" />

      <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">ארכיון הטורניר</h2>


      <div className="row">
        {/* Sidebar: Season Selector */}
        <div className="col-lg-3 mb-4">
          <div className="season-list card shadow-sm border-0 p-3">
            <h5 className="fw-bold text-success border-bottom pb-2 mb-3">עונות קודמות</h5>
            {seasons.map(s => (
              <button
                type="button"
                key={s.yearMonth}
                onClick={() => fetchSeasonDetail(s.yearMonth)}
                className={`btn season-btn w-100 mb-2 text-start ${selectedSeason?.yearMonth === s.yearMonth ? 'active' : ''}`}
              >
                <div className="fw-bold">{s.displayName}</div>
                <small className="opacity-50">{s.yearMonth}</small>
              </button>
            ))}
            {seasons.length === 0 && <p className="text-center opacity-50 small py-3">אין עונות בארכיון עדיין</p>}
          </div>
        </div>

        {/* Main Exhibit */}
        <div className="col-lg-9">
          {selectedSeason ? (
            <div className="season-exhibit">
              <div className="hero-stats row mb-4 text-center">
                <div className="col-md-4 mb-3">
                  <div className="stat-box stat-box--gold card h-100 shadow-sm border-0 dashboard-card top-scorer">
                    <div className="premium-scorer-wrapper">
                      <div className="emoji-icon mb-2">🏆</div>
                      <div className="scorer-name">האלופה</div>
                      <div className="h4 fw-bold">{selectedSeason.winner.name}</div>
                    </div>
                  </div>
                </div>
                {selectedSeason.mvp && (
                  <div className="col-md-4 mb-3">
                    <div className="stat-box stat-box--mvp card h-100 shadow-sm border-0 dashboard-card top-scorer">
                      <div className="premium-scorer-wrapper">
                        <div className="emoji-icon mb-2">⭐</div>
                        <div className="scorer-name text-white">השחקן המצטיין</div>
                        <div className="h4 mb-1 fw-bold text-white">{selectedSeason.mvp.name}</div>
                        <div className="small text-white opacity-75">{selectedSeason.mvp.teamName}</div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="col-md-4 mb-3">
                  <div className="stat-box stat-box--gold card h-100 shadow-sm border-0 dashboard-card top-scorer">
                    <div className="premium-scorer-wrapper">
                      <div className="emoji-icon mb-2">⚽</div>
                      <div className="scorer-name">מלך השערים</div>
                      <div className="h4 fw-bold mb-0">{selectedSeason.topScorer.name}</div>
                      <div className="fw-bold fs-3 mt-2" style={{ color: 'var(--primary-green)' }}>{selectedSeason.topScorer.goals} שערים</div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedSeason.summary && (
                <div className="card shadow-sm border-0 p-4 mb-5 text-center archive-summary-card">
                  <p className="lead mb-0 italic-text">"{selectedSeason.summary}"</p>
                </div>
              )}

              {/* Playoffs */}
              {selectedSeason.playoffs && selectedSeason.playoffs.length > 0 && (
                <div className="mb-5 animate-fade-in">
                  <h4 className="text-success mb-4 border-bottom border-success pb-2 fw-bold">שלבי הנוקאאוט</h4>
                  <div className="row g-4">
                    {selectedSeason.playoffs.map((match: any) => (
                      <div key={match.id} className="col-md-6 col-lg-4">
                        <div className="match-card finished card shadow-sm border-0 h-100">
                          <div className="card-body p-3">
                            {match.phase === 'knockout' && (
                              <div className="match-card-badges justify-content-center">
                                <span className="playoff-badge">פלייאוף</span>
                              </div>
                            )}
                            <div className="match-meta justify-content-center mb-3">
                              <span className="match-date">
                                {new Date(match.date).toLocaleDateString('he-IL')}
                              </span>
                              <span className="mx-2">|</span>
                              <span className="match-location">{match.location}</span>
                            </div>

                            <div className="match-teams-score">
                              <div className="team-side">
                                <div className="team-name mb-1">{match.team1Name || `קבוצה ${match.team1Id}`}</div>
                                <div className="team-score fs-3">{match.score1}</div>
                              </div>

                              <div className="vs-divider px-2 fw-black opacity-25">VS</div>

                              <div className="team-side">
                                <div className="team-score fs-3">{match.score2}</div>
                                <div className="team-name mt-1">{match.team2Name || `קבוצה ${match.team2Id}`}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tables */}
              <div className="row stats-page">
                <div className="col-12 mb-4">
                  <div className="standings-table card shadow-sm border-0 animate-fade-in">
                    <div className="card-header bg-theme-green text-white py-3">
                      <h4 className="mb-0 fw-bold">טבלת הליגה הסופית</h4>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <caption className="visually-hidden">טבלת ליגה: עונה {selectedSeason.year}</caption>
                        <thead>
                          <tr>
                            <th scope="col">מיקום</th>
                            <th scope="col" className="text-end">קבוצה</th>
                            <th scope="col">מש'</th>
                            <th scope="col">נצ'</th>
                            <th scope="col">תיקו</th>
                            <th scope="col">הפס'</th>
                            <th scope="col">הפרש</th>
                            <th scope="col">נק'</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSeason.standings.map((team: any, index: number) => (
                            <tr key={team.teamId} className={index < STANDINGS_PLAYOFF_ZONE_SIZE ? 'qualified' : ''}>
                              <td className="position">{index + 1}</td>
                              <td className="team-name text-end fw-bold">{team.teamName || team.name}</td>
                              <td>{team.played}</td>
                              <td>{team.won ?? team.wins}</td>
                              <td>{team.drawn ?? team.draws}</td>
                              <td>{team.lost ?? team.losses}</td>
                              <td className={(team.goalDifference ?? team.goalDiff) > 0 ? 'text-success fw-bold' : (team.goalDifference ?? team.goalDiff) < 0 ? 'text-danger fw-bold' : ''}>
                                {(team.goalDifference ?? team.goalDiff) > 0 ? `+${team.goalDifference ?? team.goalDiff}` : (team.goalDifference ?? team.goalDiff)}
                              </td>
                              <td className="points">{team.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="col-12 mb-4">
                  <div className="top-scorers-list card shadow-sm border-0 animate-fade-in">
                    <div className="card-header bg-theme-green text-white py-3">
                      <h4 className="mb-0 fw-bold">מבקיעים</h4>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <caption className="visually-hidden">מבקיעי העונה {selectedSeason.year}</caption>
                        <thead>
                          <tr>
                            <th scope="col">#</th>
                            <th scope="col" className="text-end">שחקן</th>
                            <th scope="col" className="text-end">כינוי</th>
                            <th scope="col" className="text-end">קבוצה</th>
                            <th scope="col">שערים</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSeason.topScorers.map((scorer: any, index: number) => (
                            <tr key={scorer.memberId}>
                              <td className="scorer-rank">{index + 1}</td>
                              <td className="team-name text-end fw-bold">{scorer.playerName || scorer.name}</td>
                              <td className="text-end text-muted small">{displayOrDash(scorer.nickname)}</td>
                              <td className="text-end">{scorer.teamName}</td>
                              <td className="points">{scorer.goals}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-5 opacity-50">
              {error || 'בחר עונה מהרשימה לצפייה בנתונים'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Archive;
