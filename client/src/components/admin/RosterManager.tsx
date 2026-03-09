import { useEffect, useState } from 'react';
import { adminAPI, teamsAPI } from '../../api/client';
import type { Team } from '../../types';
import './RosterManager.css';

interface TeamRequest {
    _id: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
    pendingTeamRequest: {
        teamName: string;
        description: string;
        status: string;
    };
    createdAt: string;
}

interface MappedUser {
    _id: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
    role: string;
    mappedPlayerInfo: {
        teamId: number;
        status: 'pending' | 'approved' | 'rejected';
        memberId?: number;
    };
    resolvedTeamName?: string;
    resolvedPlayerName?: string;
}

const RosterManager = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [userMappings, setUserMappings] = useState<MappedUser[]>([]);
    const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [teamsRes, mappingsRes, requestsRes] = await Promise.all([
                teamsAPI.getAll(),
                adminAPI.getUserMappings(),
                adminAPI.getTeamRequests()
            ]);
            setTeams(teamsRes.data);
            setUserMappings(mappingsRes.data);
            setTeamRequests(requestsRes.data);
        } catch (err) {
            console.error('Failed to fetch roster data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (userMappings.length > 0) {
            console.log('User Mappings Data:', userMappings.map(u => ({
                name: u.displayName,
                team: u.mappedPlayerInfo.teamId,
                member: u.mappedPlayerInfo.memberId,
                status: u.mappedPlayerInfo.status
            })));
        }
    }, [userMappings]);

    const toggleTeam = (teamId: number) => {
        const next = new Set(expandedTeams);
        if (next.has(teamId)) next.delete(teamId);
        else next.add(teamId);
        setExpandedTeams(next);
    };

    const handleTeamRequest = async (userId: string, action: 'approved' | 'rejected') => {
        setActionLoading(userId + action);
        try {
            await adminAPI.approveTeamRequest(userId, action);
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה');
        } finally {
            setActionLoading(null);
        }
    };

    const handleMappingAction = async (userId: string, teamId: number, status: string, role: string) => {
        setActionLoading(userId + status);
        try {
            await adminAPI.updateUserMapping(userId, { teamId, status, role });
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה');
        } finally {
            setActionLoading(null);
        }
    };

    const deletePlayerPhoto = async (teamId: number, memberId: number) => {
        if (!confirm('האם למחוק את התמונה?')) return;
        try {
            await adminAPI.deletePlayerPhoto(teamId, memberId);
            await fetchData();
        } catch (err) {
            alert('שגיאה במחיקת תמונה');
        }
    };

    const handleDeleteTeamLogo = async (teamId: number) => {
        if (!confirm('האם למחוק את לוגו הקבוצה?')) return;
        try {
            await teamsAPI.deleteLogo(teamId);
            await fetchData();
        } catch (err) {
            alert('שגיאה במחיקת לוגו הקבוצה');
        }
    };

    if (loading) return <div className="text-center py-5"><span className="spinner-border text-success" /></div>;

    const pendingMappings = userMappings.filter(u => u.mappedPlayerInfo.status === 'pending');

    return (
        <div className="roster-manager">
            {/* 1. Pending Team Requests */}
            {teamRequests.length > 0 && (
                <section className="roster-section mb-5">
                    <h3 className="section-title"><i className="bi bi-flag-fill me-2" />בקשות להקמת קבוצה</h3>
                    <div className="matches-table-wrapper">
                        <table className="matches-table">
                            <thead>
                                <tr>
                                    <th>משתמש</th>
                                    <th>קבוצה מבוקשת</th>
                                    <th>תיאור</th>
                                    <th>פעולות</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teamRequests.map(req => (
                                    <tr key={req._id} className="match-table-row">
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                {req.avatarUrl && <img src={req.avatarUrl} alt="" className="avatar-sm" />}
                                                <div>
                                                    <div className="fw-bold">{req.displayName}</div>
                                                    <div className="text-muted small">{req.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="fw-bold text-theme-green">{req.pendingTeamRequest.teamName}</td>
                                        <td className="small text-muted">{req.pendingTeamRequest.description || '—'}</td>
                                        <td>
                                            <div className="d-flex gap-2">
                                                <button className="btn btn-theme-green btn-sm" disabled={!!actionLoading} onClick={() => handleTeamRequest(req._id, 'approved')}>אשר</button>
                                                <button className="btn btn-secondary btn-sm" disabled={!!actionLoading} onClick={() => handleTeamRequest(req._id, 'rejected')}>דחה</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* 2. Unmapped Users */}
            <section className="roster-section mb-5">
                <h3 className="section-title"><i className="bi bi-person-plus-fill me-2" />שיוך משתמשים (Pending)</h3>
                {pendingMappings.length === 0 ? (
                    <div className="alert alert-dark text-center">אין בקשות שיוך ממתינות</div>
                ) : (
                    <div className="matches-table-wrapper">
                        <table className="matches-table">
                            <thead>
                                <tr>
                                    <th>משתמש</th>
                                    <th>קבוצה מבוקשת #</th>
                                    <th>פעולות מהירות</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingMappings.map(u => (
                                    <tr key={u._id} className="match-table-row">
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                {u.avatarUrl && <img src={u.avatarUrl} alt="" className="avatar-sm" />}
                                                <div>
                                                    <div className="fw-bold">{u.displayName}</div>
                                                    <div className="text-muted small">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="fw-bold">
                                            {u.resolvedTeamName}
                                            <div className="small text-muted fw-normal">{u.resolvedPlayerName}</div>
                                        </td>
                                        <td>
                                            <div className="d-flex gap-2">
                                                <button className="btn btn-theme-green btn-sm" disabled={!!actionLoading}
                                                    onClick={() => handleMappingAction(u._id, u.mappedPlayerInfo.teamId, 'approved', 'Player')}>
                                                    אשר כשחקן
                                                </button>
                                                <button className="btn btn-warning btn-sm" disabled={!!actionLoading}
                                                    onClick={() => handleMappingAction(u._id, u.mappedPlayerInfo.teamId, 'approved', 'Captain')}>
                                                    אשר כקפטן
                                                </button>
                                                <button className="btn btn-secondary btn-sm" disabled={!!actionLoading}
                                                    onClick={() => handleMappingAction(u._id, u.mappedPlayerInfo.teamId, 'rejected', 'User')}>
                                                    דחה
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* 3. Team Roster (Expandable) */}
            <section className="roster-section">
                <h3 className="section-title"><i className="bi bi-people-fill me-2" />ניהול סגלי קבוצות</h3>
                <div className="teams-accordion">
                    {teams.sort((a, b) => a.id - b.id).map(team => {
                        const isExpanded = expandedTeams.has(team.id);
                        return (
                            <div key={team.id} className={`team-row ${isExpanded ? 'expanded' : ''}`}>
                                <div className="team-header" onClick={() => toggleTeam(team.id)}>
                                    <div className="team-info-main d-flex align-items-center gap-2">
                                        <span className="team-badge">#{team.id}</span>
                                        {(team as any).logoUrl && (
                                            <div className="position-relative d-flex align-items-center">
                                                <img src={(team as any).logoUrl.startsWith('http') ? (team as any).logoUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')}${(team as any).logoUrl}`}
                                                    alt="" style={{ height: '24px', width: '24px', objectFit: 'contain' }} />
                                                <button className="btn btn-danger btn-sm p-0 d-flex align-items-center justify-content-center position-absolute top-0 start-0"
                                                    style={{ width: '14px', height: '14px', borderRadius: '50%', transform: 'translate(-50%, -50%)', fontSize: '8px' }}
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTeamLogo(team.id); }} title="מחק לוגו">
                                                    <i className="bi bi-x" />
                                                </button>
                                            </div>
                                        )}
                                        <span className="team-name">{team.name}</span>
                                        <span className="player-count">({team.players.length} שחקנים)</span>
                                    </div>
                                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`} />
                                </div>
                                {isExpanded && (
                                    <div className="team-body px-3 py-3">
                                        <div className="players-grid">
                                            {team.players.map(player => {
                                                const mappedUser = userMappings.find(u =>
                                                    u.mappedPlayerInfo?.status === 'approved' &&
                                                    Number(u.mappedPlayerInfo?.teamId) === team.id &&
                                                    Number(u.mappedPlayerInfo?.memberId) === player.memberId
                                                );

                                                return (
                                                    <div key={player.memberId} className="admin-player-card">
                                                        <div className="player-card-photo">
                                                            {player.head_photo ? (
                                                                <>
                                                                    <img src={player.head_photo.startsWith('http') ? player.head_photo : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '')}${player.head_photo}`} alt="" />
                                                                    <button className="delete-photo-btn" onClick={() => deletePlayerPhoto(team.id, player.memberId)}>
                                                                        <i className="bi bi-trash" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <i className="bi bi-person-fill" />
                                                            )}
                                                        </div>
                                                        <div className="player-card-info">
                                                            <div className="player-name">
                                                                {player.firstName} {player.lastName}
                                                                {player.isCaptain && <span className="ms-1 text-warning" title="קפטן"><i className="bi bi-star-fill small" /></span>}
                                                            </div>
                                                            <div className="player-meta">#{player.number} | {player.position}</div>
                                                            {mappedUser && (
                                                                <div className="d-flex align-items-center mt-2 flex-wrap gap-2">
                                                                    <div className="mapped-user-tag m-0">
                                                                        <i className="bi bi-person-check-fill me-1" />
                                                                        {mappedUser.displayName}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="unmap-btn"
                                                                        disabled={!!actionLoading}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (confirm(`האם לנתק את השיוך של ${mappedUser.displayName} משחקן זה? המשתמש יחזור לדרגת 'User'.`)) {
                                                                                handleMappingAction(mappedUser._id, team.id, 'rejected', 'User');
                                                                            }
                                                                        }}
                                                                    >
                                                                        <i className="bi bi-person-x-fill" />
                                                                        <span>נתק משתמש</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section >
        </div >
    );
};

export default RosterManager;
