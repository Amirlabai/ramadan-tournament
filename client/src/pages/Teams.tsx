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
                                                            <div className="roster-player-card">
                                                                {player.isCaptain && <span className="badge bg-warning text-dark">קפטן ⭐</span>}
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
        </div>
    );
};

export default Teams;
