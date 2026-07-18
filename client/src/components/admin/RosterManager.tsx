import { useEffect, useState } from 'react';
import { adminAPI, teamsAPI } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import {
    canManageTeamRoster,
    isPlatformAdmin,
    type RegistrationDivisionSlug,
} from '../../utils/tournamentUser';
import { PlayerHeadImg } from '../../components/PlayerHeadImg';
import { resolveAssetUrl } from '../../utils/assetUrl';
import type { Team } from '../../types';
import RegistrationWorkflowAdmin from './RegistrationWorkflowAdmin';
import AdminCaptainPicker from './AdminCaptainPicker';
import './RosterManager.css';

interface TeamRequest {
    id: string;
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
    id: string;
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

interface AddPlayerForm {
    firstName: string;
    lastName: string;
    nickname: string;
    number: string;
    position: string;
    isCaptain: boolean;
}

/** Legacy map-player / team-requests — superseded by RegistrationWorkflowAdmin (PRD §16). */
const LEGACY_ROSTER_WORKFLOWS = false;

const EMPTY_FORM: AddPlayerForm = {
    firstName: '',
    lastName: '',
    nickname: '',
    number: '',
    position: '',
    isCaptain: false,
};

/** Avoid boys/girls team id collision in merged admin roster list. */
type AdminTeamRow = { team: Team; slug: RegistrationDivisionSlug };

function teamRowKey(slug: RegistrationDivisionSlug, teamId: number): string {
    return `${slug}:${teamId}`;
}

const RosterManager = () => {
    const { user } = useAuth();
    const platformAdmin = isPlatformAdmin(user);

    const [teams, setTeams] = useState<AdminTeamRow[]>([]);
    const [userMappings, setUserMappings] = useState<MappedUser[]>([]);
    const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Add-player form state: keyed by composite row key
    const [addingToTeam, setAddingToTeam] = useState<string | null>(null);
    const [addForm, setAddForm] = useState<AddPlayerForm>(EMPTY_FORM);

    const fetchData = async () => {
        try {
            const [boysRes, girlsRes] = await Promise.all([
                teamsAPI.getAll('boys'),
                teamsAPI.getAll('girls').catch(() => ({ data: [] as Team[] })),
            ]);
            const rows: AdminTeamRow[] = [
                ...boysRes.data.map((t: Team) => ({ team: t, slug: 'boys' as const })),
                ...(girlsRes.data as Team[]).map((t) => ({ team: t, slug: 'girls' as const })),
            ];
            setTeams(rows);
            if (LEGACY_ROSTER_WORKFLOWS) {
                const [mappingsRes, requestsRes] = await Promise.all([
                    adminAPI.getUserMappings(),
                    adminAPI.getTeamRequests(),
                ]);
                setUserMappings(mappingsRes.data);
                setTeamRequests(requestsRes.data);
            } else {
                setUserMappings([]);
                setTeamRequests([]);
            }
        } catch (err) {
            console.error('Failed to fetch roster data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleTeam = (rowKey: string) => {
        const next = new Set(expandedTeams);
        if (next.has(rowKey)) next.delete(rowKey);
        else next.add(rowKey);
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

    const deletePlayerPhoto = async (teamId: number, memberId: number, slug: RegistrationDivisionSlug) => {
        if (!confirm('האם למחוק את התמונה?')) return;
        try {
            await teamsAPI.deletePlayerPhoto(teamId, memberId, slug);
            await fetchData();
        } catch (err) {
            alert('שגיאה במחיקת תמונה');
        }
    };

    const handleDeleteTeamLogo = async (teamId: number, slug: RegistrationDivisionSlug) => {
        if (!confirm('האם למחוק את לוגו הקבוצה?')) return;
        try {
            await teamsAPI.deleteLogo(teamId, slug);
            await fetchData();
        } catch (err) {
            alert('שגיאה במחיקת לוגו הקבוצה');
        }
    };

    // --- New admin actions ---

    const handleAddPlayer = async (teamId: number, slug: RegistrationDivisionSlug) => {
        if (!addForm.firstName.trim() || !addForm.number.trim()) {
            alert('שם פרטי ומספר שחקן הם שדות חובה');
            return;
        }
        setActionLoading(`add-${slug}-${teamId}`);
        try {
            await teamsAPI.addPlayer(teamId, {
                firstName: addForm.firstName.trim(),
                lastName: addForm.lastName.trim(),
                nickname: addForm.nickname.trim(),
                number: Number(addForm.number),
                position: addForm.position.trim(),
                isCaptain: addForm.isCaptain,
            }, slug);
            setAddingToTeam(null);
            setAddForm(EMPTY_FORM);
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בהוספת שחקן');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeletePlayer = async (
        teamId: number,
        memberId: number,
        playerName: string,
        slug: RegistrationDivisionSlug
    ) => {
        if (!confirm(`האם למחוק את השחקן ${playerName} מהקבוצה? פעולה זו בלתי הפיכה.`)) return;
        setActionLoading(`del-${slug}-${teamId}-${memberId}`);
        try {
            await teamsAPI.deletePlayer(teamId, memberId, slug);
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה במחיקת שחקן');
        } finally {
            setActionLoading(null);
        }
    };

    const handleMovePlayer = async (
        teamId: number,
        memberId: number,
        targetTeamId: number,
        playerName: string,
        slug: RegistrationDivisionSlug
    ) => {
        const targetRow = teams.find((r) => r.team.id === targetTeamId && r.slug === slug);
        if (!confirm(`להעביר את ${playerName} לקבוצה "${targetRow?.team.name ?? targetTeamId}"?`)) return;
        setActionLoading(`move-${slug}-${teamId}-${memberId}`);
        try {
            await teamsAPI.movePlayer(teamId, memberId, targetTeamId, slug);
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בהעברת שחקן');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="text-center py-5"><span className="spinner-border text-success" /></div>;

    const pendingMappings = userMappings.filter(u => u.mappedPlayerInfo.status === 'pending');
    const visibleTeams = teams;

    return (
        <div className="roster-manager">
            {platformAdmin && (
                <section className="roster-section mb-5">
                    <RegistrationWorkflowAdmin />
                </section>
            )}
            {/* 1. Pending Team Requests (legacy) */}
            {LEGACY_ROSTER_WORKFLOWS && teamRequests.length > 0 && (
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
                                    <tr key={req.id} className="match-table-row">
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                {req.avatarUrl && <img src={resolveAssetUrl(req.avatarUrl) ?? ''} alt="" className="avatar-sm" />}
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
                                                <button className="btn btn-theme-green btn-sm" disabled={!!actionLoading} onClick={() => handleTeamRequest(req.id, 'approved')}>אשר</button>
                                                <button className="btn btn-secondary btn-sm" disabled={!!actionLoading} onClick={() => handleTeamRequest(req.id, 'rejected')}>דחה</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* 2. Unmapped Users (legacy) */}
            {LEGACY_ROSTER_WORKFLOWS && (
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
                                    <tr key={u.id} className="match-table-row">
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                {u.avatarUrl && <img src={resolveAssetUrl(u.avatarUrl) ?? ''} alt="" className="avatar-sm" />}
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
                                                    onClick={() => handleMappingAction(u.id, u.mappedPlayerInfo.teamId, 'approved', 'Player')}>
                                                    אשר כשחקן
                                                </button>
                                                <button className="btn btn-warning btn-sm" disabled={!!actionLoading}
                                                    onClick={() => handleMappingAction(u.id, u.mappedPlayerInfo.teamId, 'approved', 'Captain')}>
                                                    אשר כקפטן
                                                </button>
                                                <button className="btn btn-secondary btn-sm" disabled={!!actionLoading}
                                                    onClick={() => handleMappingAction(u.id, u.mappedPlayerInfo.teamId, 'rejected', 'User')}>
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
            )}

            {/* 3. Team Roster (Expandable) */}
            <section className="roster-section">
                <h3 className="section-title">
                    <i className="bi bi-people-fill me-2" />
                    ניהול סגלי קבוצות
                </h3>
                <div className="teams-accordion">
                    {visibleTeams
                        .sort((a, b) => a.slug.localeCompare(b.slug) || a.team.id - b.team.id)
                        .map(({ team, slug }) => {
                        const rowKey = teamRowKey(slug, team.id);
                        const isExpanded = expandedTeams.has(rowKey);
                        const isAddingHere = addingToTeam === rowKey;
                        const canManage = canManageTeamRoster(user, team.id);
                        return (
                            <div key={rowKey} className={`team-row ${isExpanded ? 'expanded' : ''}`}>
                                <div className="team-header" onClick={() => toggleTeam(rowKey)}>
                                    <div className="team-info-main d-flex align-items-center gap-2">
                                        <span className="team-badge">#{team.id}</span>
                                        <span className="badge bg-secondary">{slug === 'girls' ? 'בנות' : 'בנים'}</span>
                                        {(team as any).logoUrl && (
                                            <div className="position-relative d-flex align-items-center">
                                                <img src={resolveAssetUrl((team as any).logoUrl) ?? ''}
                                                    alt="" className="team-logo-inline" />
                                                {platformAdmin && (
                                                <button className="btn btn-danger btn-sm p-0 d-flex align-items-center justify-content-center position-absolute top-0 start-0"
                                                    style={{ width: '14px', height: '14px', borderRadius: '50%', transform: 'translate(-50%, -50%)', fontSize: '8px' }}
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTeamLogo(team.id, slug); }} title="מחק לוגו">
                                                    <i className="bi bi-x" />
                                                </button>
                                                )}
                                            </div>
                                        )}
                                        <span className="team-name">{team.name}</span>
                                        <span className="player-count">({team.players.length} שחקנים)</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        {canManage && (
                                            <button
                                                className="btn btn-theme-green btn-sm add-player-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isAddingHere) {
                                                        setAddingToTeam(null);
                                                        setAddForm(EMPTY_FORM);
                                                    } else {
                                                        setAddingToTeam(rowKey);
                                                        setAddForm(EMPTY_FORM);
                                                        setExpandedTeams(prev => new Set([...prev, rowKey]));
                                                    }
                                                }}
                                                title="הוסף שחקן לקבוצה"
                                            >
                                                <i className={`bi bi-person-${isAddingHere ? 'dash' : 'plus'}-fill`} />
                                                <span className="ms-1">{isAddingHere ? 'בטל' : 'הוסף שחקן'}</span>
                                            </button>
                                        )}
                                        <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="team-body px-3 py-3">
                                        {/* Add player inline form */}
                                        {canManage && isAddingHere && (
                                            <div className="add-player-form mb-3 p-3">
                                                <h6 className="mb-3" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                                                    <i className="bi bi-person-plus-fill me-2" />הוספת שחקן ל{team.name}
                                                </h6>
                                                <div className="row g-2">
                                                    <div className="col-6 col-md-3">
                                                        <label htmlFor={`roster-add-firstName-${team.id}`} className="form-label visually-hidden">שם פרטי</label>
                                                        <input
                                                            id={`roster-add-firstName-${team.id}`}
                                                            className="form-control form-control-sm"
                                                            placeholder="שם פרטי *"
                                                            aria-label="שם פרטי"
                                                            value={addForm.firstName}
                                                            onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="col-6 col-md-3">
                                                        <label htmlFor={`roster-add-lastName-${team.id}`} className="form-label visually-hidden">שם משפחה</label>
                                                        <input
                                                            id={`roster-add-lastName-${team.id}`}
                                                            className="form-control form-control-sm"
                                                            placeholder="שם משפחה"
                                                            aria-label="שם משפחה"
                                                            value={addForm.lastName}
                                                            onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="col-6 col-md-3">
                                                        <label htmlFor={`roster-add-nickname-${team.id}`} className="form-label visually-hidden">כינוי</label>
                                                        <input
                                                            id={`roster-add-nickname-${team.id}`}
                                                            className="form-control form-control-sm"
                                                            placeholder="כינוי"
                                                            aria-label="כינוי"
                                                            value={addForm.nickname}
                                                            onChange={e => setAddForm(f => ({ ...f, nickname: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="col-3 col-md-1">
                                                        <label htmlFor={`roster-add-number-${team.id}`} className="form-label visually-hidden">מספר חולצה</label>
                                                        <input
                                                            id={`roster-add-number-${team.id}`}
                                                            className="form-control form-control-sm"
                                                            placeholder="מס׳ *"
                                                            aria-label="מספר חולצה"
                                                            type="number"
                                                            value={addForm.number}
                                                            onChange={e => setAddForm(f => ({ ...f, number: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="col-6 col-md-2">
                                                        <label htmlFor={`roster-add-position-${team.id}`} className="form-label visually-hidden">עמדה</label>
                                                        <input
                                                            id={`roster-add-position-${team.id}`}
                                                            className="form-control form-control-sm"
                                                            placeholder="עמדה"
                                                            aria-label="עמדה"
                                                            value={addForm.position}
                                                            onChange={e => setAddForm(f => ({ ...f, position: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="col-12 col-md-auto d-flex align-items-center gap-2">
                                                        <div className="form-check mb-0">
                                                            <input
                                                                className="form-check-input"
                                                                type="checkbox"
                                                                id={`cap-${team.id}`}
                                                                checked={addForm.isCaptain}
                                                                onChange={e => setAddForm(f => ({ ...f, isCaptain: e.target.checked }))}
                                                            />
                                                            <label className="form-check-label small text-muted" htmlFor={`cap-${team.id}`}>קפטן</label>
                                                        </div>
                                                        <button
                                                            className="btn btn-theme-green btn-sm"
                                                            disabled={actionLoading === `add-${slug}-${team.id}`}
                                                            onClick={() => handleAddPlayer(team.id, slug)}
                                                        >
                                                            {actionLoading === `add-${slug}-${team.id}` ? <span className="spinner-border spinner-border-sm" /> : 'שמור'}
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => { setAddingToTeam(null); setAddForm(EMPTY_FORM); }}
                                                        >
                                                            בטל
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {platformAdmin ? (
                                            <AdminCaptainPicker
                                                key={`captain-${rowKey}`}
                                                teamId={team.id}
                                                teamName={team.name}
                                                slug={slug}
                                                onSaved={() => void fetchData()}
                                            />
                                        ) : null}

                                        <div className="players-grid">
                                            {team.players.map(player => {
                                                const mappedUser = userMappings.find(u =>
                                                    u.mappedPlayerInfo?.status === 'approved' &&
                                                    Number(u.mappedPlayerInfo?.teamId) === team.id &&
                                                    Number(u.mappedPlayerInfo?.memberId) === player.memberId
                                                );
                                                const isDeleting = actionLoading === `del-${slug}-${team.id}-${player.memberId}`;
                                                const isMoving = actionLoading === `move-${slug}-${team.id}-${player.memberId}`;

                                                return (
                                                    <div key={player.memberId} className="admin-player-card">
                                                        <div className="player-card-photo">
                                                            <PlayerHeadImg
                                                                player={player}
                                                                alt={`תמונת ${player.firstName} ${player.lastName}`}
                                                            />
                                                            {player.head_photo && canManage && (
                                                                <button
                                                                    type="button"
                                                                    className="delete-photo-btn"
                                                                    onClick={() => deletePlayerPhoto(team.id, player.memberId, slug)}
                                                                    aria-label="מחק תמונה"
                                                                >
                                                                    <i className="bi bi-trash" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="player-card-info">
                                                            <div className="player-name">
                                                                {player.firstName} {player.lastName}
                                                                {player.isCaptain && <span className="ms-1 text-warning" title="קפטן"><i className="bi bi-star-fill small" /></span>}
                                                            </div>
                                                            <div className="player-meta">#{player.number} | {player.position}</div>
                                                            {mappedUser && platformAdmin && (
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
                                                                                handleMappingAction(mappedUser.id, team.id, 'rejected', 'User');
                                                                            }
                                                                        }}
                                                                    >
                                                                        <i className="bi bi-person-x-fill" />
                                                                        <span>נתק משתמש</span>
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Admin-only actions */}
                                                            {canManage && (
                                                                <div className="admin-player-actions mt-2 d-flex gap-1 flex-wrap">
                                                                    {platformAdmin && (
                                                                    <select
                                                                        className="form-select form-select-sm player-move-select"
                                                                        value=""
                                                                        disabled={isMoving || !!actionLoading}
                                                                        onChange={e => {
                                                                            const targetId = Number(e.target.value);
                                                                            if (targetId) {
                                                                                handleMovePlayer(team.id, player.memberId, targetId, `${player.firstName} ${player.lastName}`, slug);
                                                                            }
                                                                        }}
                                                                        title="העבר לקבוצה אחרת"
                                                                    >
                                                                        <option value="">— העבר לקבוצה —</option>
                                                                        {teams.filter(r => r.slug === slug && r.team.id !== team.id).map(r => (
                                                                            <option key={teamRowKey(r.slug, r.team.id)} value={r.team.id}>{r.team.name}</option>
                                                                        ))}
                                                                    </select>
                                                                    )}

                                                                    <button
                                                                        className="btn btn-danger btn-sm player-delete-btn"
                                                                        disabled={isDeleting || !!actionLoading}
                                                                        title="מחק שחקן"
                                                                        onClick={() => handleDeletePlayer(team.id, player.memberId, `${player.firstName} ${player.lastName}`, slug)}
                                                                    >
                                                                        {isDeleting
                                                                            ? <span className="spinner-border spinner-border-sm" />
                                                                            : <><i className="bi bi-trash-fill me-1" />מחק</>}
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
            </section>
        </div>
    );
};

export default RosterManager;
