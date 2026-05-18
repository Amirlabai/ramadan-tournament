import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI, teamsAPI, statsAPI } from '../api/client';
import type { Standing, TopScorer } from '../types';
import CaptainTeamRequests from '../components/admin/CaptainTeamRequests';
import TournamentRegistrationCard from '../components/profile/TournamentRegistrationCard';
import SEO from '../components/SEO';
import './Profile.css';

const VITE_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

const Profile = () => {
    const { user, loading, logout, refreshUser } = useAuth();
    const navigate = useNavigate();

    const [avatarLoading, setAvatarLoading] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [teamDesc, setTeamDesc] = useState('');
    const [teamRequestMsg, setTeamRequestMsg] = useState('');

    // Player profile editing
    const playerProfile = user ? (user as any).playerProfile : null;
    const [editingPlayer, setEditingPlayer] = useState(false);
    const [playerForm, setPlayerForm] = useState({ firstName: '', lastName: '', nickname: '', number: '', position: '', bio: '' });
    const [playerSaving, setPlayerSaving] = useState(false);
    const [playerMsg, setPlayerMsg] = useState('');

    // Team settings for Captains
    const [editingTeam, setEditingTeam] = useState(false);
    const [teamSettingsForm, setTeamSettingsForm] = useState({ name: '', logoPosition: 'right' });
    const [teamSettingsSaving, setTeamSettingsSaving] = useState(false);
    const [teamSettingsMsg, setTeamSettingsMsg] = useState('');
    const [teamLogoLoading, setTeamLogoLoading] = useState(false);

    // Stats data
    const [teamStanding, setTeamStanding] = useState<Standing | null>(null);
    const [playerGoals, setPlayerGoals] = useState<number | null>(null);

    const startEditPlayer = () => {
        setPlayerForm({
            firstName: playerProfile?.firstName ?? '',
            lastName: playerProfile?.lastName ?? '',
            nickname: playerProfile?.nickname ?? '',
            number: playerProfile?.number?.toString() ?? '',
            position: playerProfile?.position ?? '',
            bio: playerProfile?.bio ?? ''
        });
        setPlayerMsg('');
        setEditingPlayer(true);
    };

    const handleSavePlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        setPlayerSaving(true);
        setPlayerMsg('');
        try {
            await usersAPI.updatePlayerProfile({ ...playerForm, number: Number(playerForm.number) });
            await refreshUser();
            setEditingPlayer(false);
            setPlayerMsg('הפרטים עודכנו בהצלחה');
        } catch (err: any) {
            setPlayerMsg(err.response?.data?.error || 'שגיאה בשמירה');
        } finally {
            setPlayerSaving(false);
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        const fetchStats = async () => {
            if (user && (user.role === 'Player' || user.role === 'Captain') && user.mappedPlayerInfo?.teamId) {
                try {
                    const [standingsRes, scorersRes] = await Promise.all([
                        statsAPI.getStandings(),
                        statsAPI.getTopScorers()
                    ]);

                    const teamId = user.mappedPlayerInfo.teamId;
                    const memberId = user.mappedPlayerInfo.memberId;

                    const standing = standingsRes.data.find((s: Standing) => s.teamId === teamId);
                    if (standing) setTeamStanding(standing);

                    const scorer = scorersRes.data.find((s: TopScorer) => s.memberId === memberId);
                    setPlayerGoals(scorer ? scorer.goals : 0);

                } catch (error) {
                    console.error('Error fetching profile stats:', error);
                }
            }
        };

        if (user) {
            fetchStats();
        }
    }, [user]);

    if (loading) {
        return <div className="text-center mt-5"><span className="spinner-border text-success"></span></div>;
    }

    if (!user) return null;

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarLoading(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            await usersAPI.uploadAvatar(formData);
            await refreshUser();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בהעלאת תמונה');
        } finally {
            setAvatarLoading(false);
        }
    };

    const handleDeleteAvatar = async () => {
        if (!confirm('למחוק את התמונה שהעלית ולחזור לתמונת Google?')) return;
        setAvatarLoading(true);
        try {
            await usersAPI.deleteAvatar();
            await refreshUser();
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה במחיקת תמונה');
        } finally {
            setAvatarLoading(false);
        }
    };

    const handleTeamRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await usersAPI.requestTeam(teamName, teamDesc);
            setTeamRequestMsg('הבקשה נשלחה בהצלחה! ממתינה לאישור מנהל.');
            setTeamName('');
            setTeamDesc('');
            await refreshUser();
        } catch (err: any) {
            setTeamRequestMsg(err.response?.data?.error || 'שגיאה בשליחת הבקשה');
        }
    };

    const handleLeaveTeam = async () => {
        if (user.role === 'Captain') {
            alert('קפטן לא יכול לעזוב את הקבוצה שלו');
            return;
        }
        if (!confirm('האם אתה בטוח שברצונך לעזוב את הקבוצה? פעולה זו תסיר את שיוכך כשחקן.')) return;
        try {
            await usersAPI.leaveTeam();
            await refreshUser();
            alert('עזבת את הקבוצה בהצלחה');
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בעזיבת הקבוצה');
        }
    };

    const handleSaveTeamMetadata = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user.mappedPlayerInfo?.teamId) return;
        setTeamSettingsSaving(true);
        setTeamSettingsMsg('');
        try {
            await teamsAPI.updateMetadata(user.mappedPlayerInfo.teamId, teamSettingsForm as any);
            await refreshUser();
            setEditingTeam(false);
            setTeamSettingsMsg('פרטי הקבוצה עודכנו בהצלחה');
        } catch (err: any) {
            setTeamSettingsMsg(err.response?.data?.error || 'שגיאה בעדכון הפרטים');
        } finally {
            setTeamSettingsSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user.mappedPlayerInfo?.teamId) return;
        setTeamLogoLoading(true);
        try {
            const formData = new FormData();
            formData.append('logo', file);
            await teamsAPI.uploadLogo(user.mappedPlayerInfo.teamId, formData);
            await refreshUser();
            alert('הלוגו הועלה בהצלחה');
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בהעלאת הלוגו');
        } finally {
            setTeamLogoLoading(false);
        }
    };

    const handleDeleteLogo = async () => {
        if (!user.mappedPlayerInfo?.teamId || !confirm('האם למחוק את לוגו הקבוצה?')) return;
        setTeamLogoLoading(true);
        try {
            await teamsAPI.deleteLogo(user.mappedPlayerInfo.teamId);
            await refreshUser();
            alert('הלוגו נמחק בהצלחה');
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה במחיקת הלוגו');
        } finally {
            setTeamLogoLoading(false);
        }
    };

    const startEditTeam = () => {
        setTeamSettingsForm({
            name: (user.mappedPlayerInfo as any)?.teamName || '',
            logoPosition: (user.mappedPlayerInfo as any)?.logoPosition || 'right'
        });
        setTeamSettingsMsg('');
        setEditingTeam(true);
    };

    const avatarSrc = user.avatarUrl
        ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : `${VITE_API_URL}${user.avatarUrl} `)
        : null;

    const roleLabels: Record<string, string> = {
        Admin: 'מנהל',
        Captain: 'קפטן',
        Player: 'שחקן',
        User: 'משתמש',
        admin: 'מנהל',
    };

    const statusColors: Record<string, string> = {
        pending: 'warning',
        approved: 'success',
        rejected: 'danger',
    };

    const pendingTeam = (user as any).pendingTeamRequest;
    const canRequestTeam = !pendingTeam || pendingTeam.status === 'rejected';
    const mappingStatus = user.mappedPlayerInfo?.status;

    // We hide the status banner entirely once the user is actually a Player or Captain, 
    // because the 'Editable Player Info' card below is enough proof they are mapped.
    const tr = user.tournamentRegistration;
    const usesPrdRegistration =
        !!(tr?.boys?.ownedTeamId || tr?.girls?.ownedTeamId) ||
        (tr?.boys?.status && tr.boys.status !== 'none') ||
        (tr?.girls?.status && tr.girls.status !== 'none');
    const showMappingBanner =
        mappingStatus &&
        !usesPrdRegistration &&
        user.role !== 'Player' &&
        user.role !== 'Captain';
    const showLegacyCaptain = user.role === 'Captain' && !usesPrdRegistration;

    return (
        <div className="profile-page">
            <SEO
                title="פרופיל אישי"
                description="עריכת פרופיל, תמונה ושיוך שחקן — טורניר קיץ 2026."
                url="https://ramadan-tournament-client.vercel.app/profile"
            />
            <div className="container py-4" style={{ maxWidth: 760 }}>

                {/* Profile Header Card */}
                <div className="profile-header-card card mb-4 p-4">
                    <div className="d-flex align-items-center gap-4 flex-wrap">
                        <label htmlFor="profile-avatar-upload" className="avatar-wrapper mb-0" title="שנה תמונה">
                            {avatarLoading ? (
                                <div className="avatar-placeholder"><span className="spinner-border spinner-border-sm" /></div>
                            ) : avatarSrc ? (
                                <img src={avatarSrc} alt={`תמונת פרופיל של ${user.displayName}`} className="avatar-img" />
                            ) : (
                                <div className="avatar-placeholder">
                                    <i className="bi bi-person-fill fs-1" />
                                </div>
                            )}
                            <span className="avatar-overlay" aria-hidden="true"><i className="bi bi-camera-fill" /></span>
                        </label>
                        <input id="profile-avatar-upload" type="file" ref={fileInputRef} accept="image/*" className="visually-hidden" onChange={handleAvatarChange} aria-label="העלאת תמונת פרופיל" />

                        {/* Delete uploaded avatar — only shown when user has a local upload */}
                        {user.avatarUrl?.startsWith('/uploads/') && (
                            <button
                                className="btn btn-link text-danger p-0 mt-1"
                                style={{ fontSize: '0.78rem' }}
                                onClick={handleDeleteAvatar}
                                disabled={avatarLoading}
                                title="מחק תמונה וחזור לתמונת Google"
                            >
                                <i className="bi bi-trash me-1" />הסר תמונה
                            </button>
                        )}

                        <div className="flex-grow-1">
                            <h2 className="mb-1">{user.displayName}</h2>
                            {user.email && <div className="text-muted small" dir="ltr">{user.email}</div>}
                            <span className={`badge bg - ${user.role === 'Admin' || user.role === 'admin' ? 'danger' : user.role === 'Captain' ? 'theme-yellow text-dark' : 'secondary'} mt - 1`}>
                                {user.role === 'Captain' && <i className="bi bi-star-fill me-1" />}
                                {roleLabels[user.role] ?? user.role}
                            </span>
                        </div>
                        <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>התנתק</button>
                    </div>
                </div>

                {/* Player Mapping Status */}
                {showMappingBanner && mappingStatus && mappingStatus !== 'approved' && (
                    <div className={`alert alert - ${statusColors[mappingStatus] ?? 'secondary'} mb - 4`}>
                        {mappingStatus === 'pending' && (
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <i className="bi bi-hourglass-split me-2" />
                                    <strong>בקשת שיוך שחקן ממתינה לאישור קפטן.</strong>
                                    {user.mappedPlayerInfo?.teamName ? ` קבוצת ${user.mappedPlayerInfo.teamName} ` : ` קבוצה #${user.mappedPlayerInfo?.teamId} `}
                                    {user.mappedPlayerInfo?.playerName && `, השחקן ${user.mappedPlayerInfo.playerName} `}
                                </div>
                                <button type="button" className="btn btn-danger btn-sm" onClick={handleLeaveTeam}>ביטול בקשה</button>
                            </div>
                        )}
                        {mappingStatus === 'rejected' && (
                            <div className="d-flex justify-content-between align-items-center">
                                <div><i className="bi bi-x-circle-fill me-2" /><strong>בקשת השיוך נדחתה.</strong> תוכל לנסות מחדש.</div>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={handleLeaveTeam}>נקה</button>
                            </div>
                        )}
                    </div>
                )}

                <TournamentRegistrationCard slug="boys" title="רישום טורניר כדורגל" />
                <TournamentRegistrationCard slug="girls" title="רישום טורניר בנות (נקודות)" />

                {/* Claim Player Profile Banner */}
                {user.role === 'User' && (!mappingStatus || mappingStatus === 'rejected') && (
                    <div className="alert custom-claim-banner d-flex align-items-center justify-content-between mb-4">
                        <div><strong>שחקן בטורניר?</strong> <span className="ms-2">שייך את פרופיל המשתמש שלך לשחקן.</span></div>
                        <span className="small">עבור לעמוד קבוצות להצטרפות</span>
                    </div>
                )}

                {/* Editable Player Info (For Players and Captains) */}
                {/* Editable Player Info (For Players and Captains) */}
                {(user.role === 'Player' || user.role === 'Captain') && (
                    <div className="card mb-4 p-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h4 className="mb-0">פרטי שחקן</h4>
                            <div className="d-flex gap-2">
                                {!editingPlayer && (
                                    <>
                                        {user.role !== 'Captain' && (
                                            <button type="button" className="btn btn-danger btn-sm" onClick={handleLeaveTeam}>
                                                <i className="bi bi-box-arrow-right me-1" />עזוב קבוצה
                                            </button>
                                        )}
                                        <button type="button" className="btn btn-success btn-sm" onClick={startEditPlayer}>
                                            <i className="bi bi-pencil-fill me-1" />{playerProfile ? 'ערוך' : 'הגדר פרופיל'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {editingPlayer ? (
                            <form onSubmit={handleSavePlayer}>
                                <div className="row g-3">
                                    <div className="col-6">
                                        <label className="form-label">שם פרטי</label>
                                        <input className="form-control" value={playerForm.firstName} maxLength={50}
                                            onChange={e => setPlayerForm(p => ({ ...p, firstName: e.target.value }))} />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label">שם משפחה</label>
                                        <input className="form-control" value={playerForm.lastName} maxLength={50}
                                            onChange={e => setPlayerForm(p => ({ ...p, lastName: e.target.value }))} />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label">כינוי / תג</label>
                                        <input className="form-control" value={playerForm.nickname} maxLength={50}
                                            onChange={e => setPlayerForm(p => ({ ...p, nickname: e.target.value }))} />
                                    </div>
                                    <div className="col-3">
                                        <label className="form-label">מספר</label>
                                        <input type="number" className="form-control" value={playerForm.number} min={1} max={99}
                                            onChange={e => setPlayerForm(p => ({ ...p, number: e.target.value }))} />
                                    </div>
                                    <div className="col-3">
                                        <label className="form-label">עמדה</label>
                                        <select className="form-select" value={playerForm.position}
                                            onChange={e => setPlayerForm(p => ({ ...p, position: e.target.value }))}>
                                            <option value="">—</option>
                                            {['שוער', 'בלם', 'מגן', 'קשר', 'חלוץ'].map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">אודות</label>
                                        <textarea className="form-control" value={playerForm.bio || ''} maxLength={300} rows={3}
                                            onChange={e => setPlayerForm(p => ({ ...p, bio: e.target.value }))} placeholder="ספר מעט על עצמך..." />
                                    </div>
                                </div>
                                {playerMsg && <div className={`alert ${playerMsg.includes('שגיאה') ? 'alert-danger' : 'alert-success'} py - 2 mt - 3`}>{playerMsg}</div>}
                                <div className="d-flex gap-2 mt-3">
                                    <button type="button" className="btn btn-secondary" onClick={() => setEditingPlayer(false)}>בטל</button>
                                    <button type="submit" className="btn btn-success" disabled={playerSaving}>
                                        {playerSaving ? <span className="spinner-border spinner-border-sm" /> : 'שמור'}
                                    </button>
                                </div>
                            </form>
                        ) : playerProfile ? (
                            <div className="row g-2 text-end">
                                <div className="col-6"><span className="text-muted small">שם פרטי</span><div className="fw-semibold">{playerProfile.firstName || '—'}</div></div>
                                <div className="col-6"><span className="text-muted small">שם משפחה</span><div className="fw-semibold">{playerProfile.lastName || '—'}</div></div>
                                <div className="col-6"><span className="text-muted small">כינוי / תג</span><div className="fw-semibold">{playerProfile.nickname || '—'}</div></div>
                                <div className="col-3"><span className="text-muted small">מספר</span><div className="fw-semibold">{playerProfile.number ?? '—'}</div></div>
                                <div className="col-3"><span className="text-muted small">עמדה</span><div className="fw-semibold">{playerProfile.position || '—'}</div></div>
                                <div className="col-12 mt-3"><span className="text-muted small">אודות</span><div className="fw-semibold" style={{ whiteSpace: 'pre-line' }}>{playerProfile.bio || '—'}</div></div>
                            </div>
                        ) : (
                            <div className="text-center py-3 text-muted">
                                <i className="bi bi-person-badge fs-2 d-block mb-2" />
                                פרטי השחקן שלך טרם הוגדרו.
                                <br />
                                לחץ על 'הגדר פרופיל' כדי להתחיל.
                            </div>
                        )}
                        {!editingPlayer && playerMsg && <div className="alert alert-success py-2 mt-3">{playerMsg}</div>}
                    </div>
                )}

                {/* Team & Player Stats Card */}
                {(teamStanding || playerGoals !== null) && (
                    <div className="card mb-4 p-4 profile-stats-card">
                        <h4 className="mb-4 d-flex align-items-center">
                            <i className="bi bi-bar-chart-fill me-2 text-primary" />
                            סטטיסטיקות טורניר — {(user as any).mappedPlayerInfo?.teamName}
                        </h4>

                        <div className="row g-3 text-center">
                            {/* Individual Goals */}
                            {playerGoals !== null && (
                                <div className="col-6 col-md-3">
                                    <div className="stat-box bg-light rounded p-3 h-100 border border-success border-opacity-25">
                                        <div className="stat-value display-6 fw-bold text-success mb-1">{playerGoals}</div>
                                        <div className="stat-label text-muted small fw-semibold">שערי שחקן</div>
                                    </div>
                                </div>
                            )}

                            {/* Points */}
                            {teamStanding && (
                                <div className="col-6 col-md-3">
                                    <div className="stat-box bg-light rounded p-3 h-100">
                                        <div className="stat-value display-6 fw-bold text-theme-green mb-1">{teamStanding.points}</div>
                                        <div className="stat-label text-muted small fw-semibold">נקודות קבוצה</div>
                                    </div>
                                </div>
                            )}

                            {/* Position & Played */}
                            {teamStanding && (
                                <div className="col-6 col-md-3">
                                    <div className="stat-box bg-light rounded p-3 h-100">
                                        <div className="stat-value fs-4 fw-bold mb-1">{teamStanding.played}</div>
                                        <div className="stat-label text-muted small fw-semibold">משחקים ששוחקו</div>
                                    </div>
                                </div>
                            )}

                            {/* W/D/L */}
                            {teamStanding && (
                                <div className="col-6 col-md-3">
                                    <div className="stat-box bg-light rounded p-3 h-100">
                                        <div className="stat-value fs-5 fw-bold mb-1" dir="ltr">
                                            <span className="text-success">{teamStanding.won}</span> /&nbsp;
                                            <span className="text-warning">{teamStanding.drawn}</span> /&nbsp;
                                            <span className="text-danger">{teamStanding.lost}</span>
                                        </div>
                                        <div className="stat-label text-muted small fw-semibold">נצחונות / תיקו / הפסדים</div>
                                    </div>
                                </div>
                            )}

                            {/* Goals Info */}
                            {teamStanding && (
                                <div className="col-12 mt-3">
                                    <div className="d-flex justify-content-around bg-light rounded p-3 border">
                                        <div>
                                            <div className="small text-muted mb-1">שערי זכות (GF)</div>
                                            <div className="fw-bold fs-5 text-success">{teamStanding.goalsFor}</div>
                                        </div>
                                        <div>
                                            <div className="small text-muted mb-1">שערי חובה (GA)</div>
                                            <div className="fw-bold fs-5 text-danger">{teamStanding.goalsAgainst}</div>
                                        </div>
                                        <div>
                                            <div className="small text-muted mb-1">הפרש שערים (GD)</div>
                                            <div className="fw-bold fs-5" dir="ltr">
                                                {teamStanding.goalDifference > 0 ? '+' : ''}{teamStanding.goalDifference}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Captain Section (legacy — owners use Teams page + RegistrationWorkflowAdmin) */}
                {showLegacyCaptain && (
                    <div className="captain-management-zone">
                        {/* Team Settings Card */}
                        <div className="card mb-4 p-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h4 className="mb-0">הגדרות קבוצה — {(user.mappedPlayerInfo as any)?.teamName}</h4>
                                {!editingTeam && (
                                    <button type="button" className="btn btn-success btn-sm" onClick={startEditTeam}>
                                        <i className="bi bi-gear-fill me-1" />ניהול קבוצה
                                    </button>
                                )}
                            </div>

                            {editingTeam ? (
                                <form onSubmit={handleSaveTeamMetadata}>
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label">שם הקבוצה</label>
                                            <input className="form-control" value={teamSettingsForm.name} maxLength={50}
                                                onChange={e => setTeamSettingsForm(t => ({ ...t, name: e.target.value }))} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">מיקום לוגו בדף הבית</label>
                                            <select className="form-select" value={teamSettingsForm.logoPosition}
                                                onChange={e => setTeamSettingsForm(t => ({ ...t, logoPosition: e.target.value as any }))}>
                                                <option value="right">ימין (רגיל)</option>
                                                <option value="left">שמאל</option>
                                                <option value="none">אל תציג לוגו</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label d-block">לוגו הקבוצה</label>
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="position-relative">
                                                {(user.mappedPlayerInfo as any)?.logoUrl ? (
                                                    <>
                                                        <img src={(user.mappedPlayerInfo as any).logoUrl.startsWith('http') ? (user.mappedPlayerInfo as any).logoUrl : `${VITE_API_URL}${(user.mappedPlayerInfo as any).logoUrl}`}
                                                            alt="Team Logo" className="team-logo-preview" style={{ width: 64, height: 64, objectFit: 'contain' }} />
                                                        <button type="button" className="btn btn-danger btn-sm position-absolute top-0 start-0 p-1" onClick={handleDeleteLogo}
                                                            title="מחק לוגו" style={{ borderRadius: '50%', transform: 'translate(-30%, -30%)' }}>
                                                            <i className="bi bi-trash-fill" style={{ fontSize: '10px' }} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="team-logo-placeholder d-flex align-items-center justify-content-center bg-light rounded" style={{ width: 64, height: 64 }}>
                                                        <i className="bi bi-image text-muted" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <input type="file" id="teamLogoInput" accept="image/*" className="d-none" onChange={handleLogoUpload} />
                                                <label htmlFor="teamLogoInput" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                                    {teamLogoLoading ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-upload me-1" />}
                                                    {(user.mappedPlayerInfo as any)?.logoUrl ? 'החלף לוגו' : 'העלה לוגו'}
                                                </label>
                                                <div className="text-muted small mt-1">מומלץ להעלות קובץ PNG שקוף</div>
                                            </div>
                                        </div>
                                    </div>

                                    {teamSettingsMsg && <div className={`alert ${teamSettingsMsg.includes('שגיאה') ? 'alert-danger' : 'alert-success'} py - 2`}>{teamSettingsMsg}</div>}

                                    <div className="d-flex gap-2">
                                        <button type="button" className="btn btn-secondary" onClick={() => setEditingTeam(false)}>ביטול</button>
                                        <button type="submit" className="btn btn-theme-green ms-auto" disabled={teamSettingsSaving}>
                                            {teamSettingsSaving ? <span className="spinner-border spinner-border-sm" /> : 'שמור שינויים'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="row">
                                    <div className="col-md-8">
                                        <div className="mb-2"><strong>שם הקבוצה:</strong> {(user.mappedPlayerInfo as any)?.teamName}</div>
                                        <div><strong>מיקום לוגו:</strong> {
                                            (user.mappedPlayerInfo as any)?.logoPosition === 'left' ? 'שמאל' :
                                                (user.mappedPlayerInfo as any)?.logoPosition === 'none' ? 'לא מוצג' : 'ימין'
                                        }</div>
                                    </div>
                                    <div className="col-md-4 text-center">
                                        {(user.mappedPlayerInfo as any)?.logoUrl ? (
                                            <img src={(user.mappedPlayerInfo as any).logoUrl.startsWith('http') ? (user.mappedPlayerInfo as any).logoUrl : `${VITE_API_URL}${(user.mappedPlayerInfo as any).logoUrl} `}
                                                alt="Team Logo" className="team-logo-display" style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain' }} />
                                        ) : (
                                            <div className="text-muted small">טרם הועלה לוגו קבוצה</div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {!editingTeam && teamSettingsMsg && <div className="alert alert-success py-2 mt-3">{teamSettingsMsg}</div>}
                        </div>

                        {/* Approvals Table */}
                        <div className="card mb-4 premium-captain-card border-none overflow-hidden">
                            <div className="card-header bg-theme-green text-white p-3 border-none">
                                <h4 className="mb-0 d-flex align-items-center">
                                    <i className="bi bi-shield-check me-2" />
                                    ניהול בקשות שחקנים לקבוצה שלך
                                </h4>
                            </div>
                            <div className="card-body p-4 bg-white">
                                <CaptainTeamRequests />
                            </div>
                        </div>
                    </div>
                )}

                {/* Team Creation Request */}
                {canRequestTeam && user.role !== 'Captain' && user.role !== 'Admin' && user.role !== 'admin' && user.role !== 'Player' && (
                    <div className="card mb-4 p-4">
                        <h4 className="mb-3">בקשה לפתיחת קבוצה חדשה</h4>
                        <p className="text-muted small">הגש בקשה ליצירת קבוצה חדשה בטורניר. לאחר אישור המנהל, תועלה לדרגת קפטן.</p>
                        {teamRequestMsg && <div className={`alert ${teamRequestMsg.includes('שגיאה') ? 'alert-danger' : 'alert-success'} py - 2`}>{teamRequestMsg}</div>}
                        {pendingTeam?.status === 'rejected' && (
                            <div className="alert alert-danger py-2 mb-3">הבקשה הקודמת שלך נדחתה. תוכל לשלוח בקשה חדשה.</div>
                        )}
                        <form onSubmit={handleTeamRequest}>
                            <div className="mb-3">
                                <label className="form-label">שם הקבוצה</label>
                                <input type="text" className="form-control" value={teamName} onChange={e => setTeamName(e.target.value)} required maxLength={50} />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">תיאור קצר (אופציונלי)</label>
                                <textarea className="form-control" rows={3} value={teamDesc} onChange={e => setTeamDesc(e.target.value)} maxLength={300} />
                            </div>
                            <button type="submit" className="btn btn-primary">שלח בקשה</button>
                        </form>
                    </div>
                )}

                {/* Pending Team Request status */}
                {pendingTeam?.status === 'pending' && (
                    <div className="alert alert-info mb-4">
                        <i className="bi bi-hourglass-split me-2" />
                        <strong>בקשת יצירת קבוצה ממתינה לאישור: </strong> "{pendingTeam.teamName}"
                    </div>
                )}

            </div>

        </div>
    );
};

export default Profile;
