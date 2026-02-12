import { useEffect, useState } from 'react';
import { teamsAPI } from '../api/client';
import type { Team } from '../types';

const Teams = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const response = await teamsAPI.getAll();
                setTeams(response.data);
            } catch (err) {
                setError('שגיאה בטעינת קבוצות');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchTeams();
    }, []);

    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

    const toggleTeam = (teamId: number) => {
        setExpandedTeam(expandedTeam === teamId ? null : teamId);
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-success" role="status"><span className="visually-hidden">טוען...</span></div></div>;
    if (error) return <div className="alert alert-danger m-3">{error}</div>;

    return (
        <div className="container">
            <h2 className="mb-4 fw-bold text-success border-bottom pb-2">קבוצות הטורניר</h2>
            <div className="table-responsive">
                <table className="table table-hover" id="teamsTable">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>שם הקבוצה</th>
                            <th>מספר שחקנים</th>
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
                                        <td className="fw-bold fs-5">{team.name}</td>
                                        <td>{team.players.length}</td>
                                        <td>{captain ? `${captain.firstName} ${captain.lastName}` : 'אין'}</td>
                                        <td>
                                            <span className="expand-icon">
                                                {isExpanded ? '▼' : '◄'}
                                            </span>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="team-details-row">
                                            <td colSpan={5} className="bg-light p-3">
                                                <div className="row g-3">
                                                    {team.players.map(player => (
                                                        <div key={player.memberId} className="col-6 col-md-4 col-lg-3">
                                                            <div
                                                                className="roster-player-card position-relative"
                                                                onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); }}
                                                                style={{ cursor: 'pointer' }}
                                                            >
                                                                {player.isCaptain && <span className="badge bg-warning text-dark position-absolute top-0 start-0 m-2">קפטן ⭐</span>}
                                                                <img
                                                                    src={`/${player.head_photo || 'assets/images/players/heads/default.jpg'}`}
                                                                    alt={player.firstName}
                                                                    className="rounded-circle mb-2"
                                                                    style={{ width: '80px', height: '80px', objectFit: 'cover', border: '3px solid #FFD700' }}
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80?text=?';
                                                                    }}
                                                                />
                                                                <div className="fw-bold">{player.firstName} {player.lastName}</div>
                                                                <div className="text-muted small">{player.nickname}</div>
                                                                <div className="badge bg-success mt-1">#{player.number}</div>
                                                                <div className="small text-secondary">{player.position}</div>
                                                            </div>
                                                        </div>
                                                    ))}
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
                                    src={`/${selectedPlayer.head_photo || 'assets/images/players/heads/default.jpg'}`}
                                    alt={selectedPlayer.firstName}
                                    className="rounded-circle mb-3 border border-3 border-warning"
                                    style={{ width: '120px', height: '120px', objectFit: 'cover' }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/120?text=?';
                                    }}
                                />
                                <h4>{selectedPlayer.nickname}</h4>
                                <div className="d-flex justify-content-center gap-2 mb-3">
                                    <span className="badge bg-success fs-6">#{selectedPlayer.number}</span>
                                    <span className="badge bg-secondary fs-6">{selectedPlayer.position}</span>
                                    {selectedPlayer.isCaptain && <span className="badge bg-warning text-dark fs-6">קפטן</span>}
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
