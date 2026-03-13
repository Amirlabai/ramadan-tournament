import { useEffect, useState } from 'react';
import { teamsAPI } from '../api/client';
import type { Team } from '../types';

const Teams = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

    const fetchTeams = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const response = await teamsAPI.getAll();
            setTeams(response.data);
            if (!isBackground) setError('');
        } catch (err) {
            if (!isBackground) setError('שגיאה בטעינת קבוצות');
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();

        const interval = setInterval(() => {
            const hour = new Date().getHours();
            if (hour >= 18 && hour <= 23) {
                fetchTeams(true);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

    const toggleTeam = (teamId: number) => {
        setExpandedTeam(expandedTeam === teamId ? null : teamId);
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-success" role="status"><span className="visually-hidden">טוען...</span></div></div>;
    if (error) return <div className="alert alert-danger m-3">{error}</div>;

    return (
        <div className="container py-4">
            <h2 className="mb-4 fw-bold text-success border-bottom pb-2">קבוצות הטורניר</h2>
            <div className="table-responsive">
                <table className="table table-hover" id="teamsTable">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>שם הקבוצה</th>
                            <th className="d-none d-md-table-cell">מספר שחקנים</th>
                            <th>קפטן</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map((team) => {
                            const captain = team.players.find(p => p.isCaptain);
                            const isExpanded = expandedTeam === team.id;

                            return (
                                <>
                                    <tr
                                        className="team-row"
                                        onClick={() => toggleTeam(team.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>{team.id}</td>
                                        <td className="fw-bold fs-8">
                                            <div className="d-flex align-items-center gap-2" style={{ width: 'max-content' }}>
                                                {team.logoPosition === 'right' && team.logoUrl && (
                                                    <img className="team-logo-inline" src={team.logoUrl.startsWith('http') ? team.logoUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')}${team.logoUrl}`} alt={`${team.name} Logo`} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                                )}
                                                <span>{team.name}</span>
                                                {team.logoPosition === 'left' && team.logoUrl && (
                                                    <img className="team-logo-inline" src={team.logoUrl.startsWith('http') ? team.logoUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')}${team.logoUrl}`} alt={`${team.name} Logo`} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                                )}
                                            </div>
                                        </td>
                                        <td className="d-none d-md-table-cell">{team.players.length}</td>
                                        <td>{captain ? `${captain.firstName} ${captain.lastName}` : 'אין'}</td>
                                        <td>
                                            <span className="expand-icon">
                                                {isExpanded ? '▼' : '►'}
                                            </span>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="team-details-row">
                                            <td colSpan={5} className="bg-light p-3">
                                                <div className="row g-3">
                                                    {(() => {
                                                        const topScorerInTeam = [...team.players].sort((a, b) => {
                                                            const goalsA = a.totalGoals || 0;
                                                            const goalsB = b.totalGoals || 0;
                                                            if (goalsB !== goalsA) return goalsB - goalsA;
                                                            const avgA = (a.totalGoals && a.gamesPlayed) ? a.totalGoals / a.gamesPlayed : 0;
                                                            const avgB = (b.totalGoals && b.gamesPlayed) ? b.totalGoals / b.gamesPlayed : 0;
                                                            return avgB - avgA;
                                                        })[0];

                                                        return team.players.map(player => {
                                                            const isTopScorer = topScorerInTeam && player.memberId === topScorerInTeam.memberId && (player.totalGoals || 0) > 0;

                                                            return (
                                                                <div key={player.memberId} className="col-6 col-md-4 col-lg-3">
                                                                    <div
                                                                        className={`roster-player-card position-relative ${isTopScorer ? 'top-scorer-highlight' : ''}`}
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); }}
                                                                        style={{ cursor: 'pointer' }}
                                                                    >
                                                                        {player.isCaptain && <span className="badge text-dark position-absolute top-0 start-0 m-2">⭐</span>}
                                                                        {isTopScorer && <span className="badge text-dark position-absolute top-0 end-0 m-2" title="מלך השערים של הקבוצה">⚽</span>}
                                                                        <div className="fw-bold">{player.nickname}</div>
                                                                        <div className="text-muted small">{player.firstName} {player.lastName}</div>
                                                                        <div className="badge bg-success mt-1">{player.number}</div>
                                                                        <div className="small text-secondary">{player.position}</div>
                                                                        <div className="mt-2 pt-2 border-top player-card-stats">
                                                                            <div className="d-flex justify-content-between small">
                                                                                <span className="text-muted">שערים:</span>
                                                                                <span className="fw-bold text-success">{player.totalGoals || 0}</span>
                                                                            </div>
                                                                            <div className="d-flex justify-content-between small">
                                                                                <span className="text-muted">ממוצע:</span>
                                                                                <span className="text-muted">
                                                                                    {(player.totalGoals && player.gamesPlayed)
                                                                                        ? (player.totalGoals / player.gamesPlayed).toFixed(2)
                                                                                        : '0.00'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Player Details Modal */}
            {selectedPlayer && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setSelectedPlayer(null)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                        <div className="modal-content">
                            <div className="modal-header bg-success text-white">
                                <h5 className="modal-title">{selectedPlayer.firstName} {selectedPlayer.lastName}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedPlayer(null)}></button>
                            </div>
                            <div className="modal-body text-center">
                                <img
                                    src={selectedPlayer.head_photo
                                        ? (selectedPlayer.head_photo.startsWith('http')
                                            ? selectedPlayer.head_photo
                                            : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')}${selectedPlayer.head_photo}`)
                                        : '/assets/images/players/heads/default.png'}
                                    alt={selectedPlayer.firstName}
                                    className="rounded-circle mb-3 border border-3 border-warning"
                                    style={{ width: '120px', height: '120px', objectFit: 'cover' }}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.onerror = null;
                                        // Simple gray placeholder SVG as data URI
                                        target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjUwIiBmaWxsPSIjNjY2Ij4/PC90ZXh0Pjwvc3ZnPg==';
                                    }}
                                />
                                <h4>{selectedPlayer.nickname}</h4>
                                <div className="d-flex justify-content-center gap-2 mb-3">
                                    <span className="badge bg-success fs-6">{selectedPlayer.number}</span>
                                    <span className="badge bg-secondary fs-6">{selectedPlayer.position}</span>
                                    {selectedPlayer.isCaptain && <span className="badge bg-warning text-dark fs-6">קפטן</span>}
                                </div>
                                <div className="d-flex justify-content-center gap-4 mb-3 py-2 bg-light rounded">
                                    <div className="text-center">
                                        <div className="small text-muted">סה"כ שערים</div>
                                        <div className="fs-4 fw-bold text-success">{selectedPlayer.totalGoals || 0}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="small text-muted">משחקים</div>
                                        <div className="fs-4 fw-bold text-dark">{selectedPlayer.gamesPlayed || 0}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="small text-muted">ממוצע למשחק</div>
                                        <div className="fs-4 fw-bold text-primary">
                                            {(selectedPlayer.totalGoals && selectedPlayer.gamesPlayed)
                                                ? (selectedPlayer.totalGoals / selectedPlayer.gamesPlayed).toFixed(2)
                                                : '0.00'}
                                        </div>
                                    </div>
                                </div>
                                <hr />
                                <div className="text-end">
                                    <h6 className="fw-bold text-success">אודות השחקן:</h6>
                                    <p>{selectedPlayer.bio || 'אין מידע נוסף אודות השחקן.'}</p>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPlayer(null)}>סגור</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Teams;
