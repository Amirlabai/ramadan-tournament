import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AccessibleModal from './AccessibleModal';
import { teamsAPI, registrationAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTournament } from '../contexts/TournamentContext';
import { needsIdentitySubmission } from '../utils/tournamentUser';
import type { Team } from '../types';
import './PlayerClaimModal.css';

interface PlayerClaimModalProps {
    onClose: () => void;
}

interface AvailablePlayer {
    memberId: number;
    firstName: string;
    lastName: string;
    nickname: string;
    number: number;
    position: string;
    isCaptain: boolean;
}

const POSITIONS = ['שוער', 'בלם', 'מגן', 'קשר', 'חלוץ'];

const PlayerClaimModal = ({ onClose }: PlayerClaimModalProps) => {
    const { user, refreshUser } = useAuth();
    const { slug } = useTournament();
    const navigate = useNavigate();

    const shouldRedirectToProfile =
        !!user &&
        (slug === 'boys' || slug === 'girls') &&
        needsIdentitySubmission(user, slug);

    const redirectToProfileForIdentity = (): boolean => {
        if (!user || (slug !== 'boys' && slug !== 'girls')) return false;
        if (!needsIdentitySubmission(user, slug)) return false;
        navigate('/profile', { state: { focusIdentity: slug } });
        onClose();
        return true;
    };

    const [step, setStep] = useState<'team' | 'player' | 'custom'>('team');
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
    const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

    const [customProfile, setCustomProfile] = useState({ firstName: '', lastName: '', nickname: '', number: '', position: '' });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!shouldRedirectToProfile) return;
        navigate('/profile', { state: { focusIdentity: slug } });
        onClose();
    }, [shouldRedirectToProfile, slug, navigate, onClose]);

    useEffect(() => {
        if (shouldRedirectToProfile) return;
        teamsAPI.getAll(slug)
            .then(r => setTeams(r.data))
            .catch(() => setError('שגיאה בטעינת קבוצות'));
    }, [slug, shouldRedirectToProfile]);

    const handleTeamNext = async () => {
        if (!selectedTeamId) { setError('יש לבחור קבוצה'); return; }
        setError('');
        setLoadingPlayers(true);
        try {
            const res = await teamsAPI.getAvailablePlayers(Number(selectedTeamId), slug);
            setAvailablePlayers(res.data);
            setStep(res.data.length > 0 ? 'player' : 'custom');
        } catch {
            setError('שגיאה בטעינת שחקנים');
        } finally {
            setLoadingPlayers(false);
        }
    };

    const handleSubmitClaim = async () => {
        if (redirectToProfileForIdentity()) return;
        if (!selectedMemberId) {
            setError('יש לבחור שחקן מהרשימה');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await registrationAPI.submitJoin(Number(selectedTeamId), slug, { memberId: selectedMemberId });
            await refreshUser();
            setSuccess(true);
            setTimeout(() => onClose(), 2500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'שגיאה בשליחת הבקשה');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitCustom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (redirectToProfileForIdentity()) return;
        setError('');
        if (!customProfile.firstName.trim() || !customProfile.lastName.trim() || !customProfile.number) {
            setError('שם פרטי, שם משפחה ומספר חולצה הם שדות חובה');
            return;
        }
        setLoading(true);
        try {
            const lastName = customProfile.lastName.trim();
            const nickname = customProfile.nickname.trim();
            await registrationAPI.submitJoin(Number(selectedTeamId), slug, {
                playerProfile: {
                    ...customProfile,
                    lastName,
                    nickname,
                    number: Number(customProfile.number),
                },
            });
            await refreshUser();
            setSuccess(true);
            setTimeout(() => onClose(), 2500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'שגיאה בשליחת הבקשה');
        } finally {
            setLoading(false);
        }
    };

    if (shouldRedirectToProfile) return null;

    const selectedTeamName = teams.find(t => t.id === Number(selectedTeamId))?.name;
    const modalTitleId = 'claim-modal-title';

    return (
        <AccessibleModal open onClose={onClose} titleId={modalTitleId} className="claim-modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2 id={modalTitleId} className="modal-title fw-bold h5">
                                {step === 'team' && 'שיוך שחקן — בחר קבוצה'}
                                {step === 'player' && `שיוך שחקן — ${selectedTeamName}`}
                                {step === 'custom' && `פרופיל שחקן חדש — ${selectedTeamName}`}
                            </h2>
                            <button type="button" className="btn-close" onClick={onClose} aria-label="סגור"></button>
                        </div>
                        <div className="modal-body p-4">
                            {success ? (
                                <div className="text-center text-theme-green py-4">
                                    <i className="bi bi-check-circle-fill display-4 mb-3"></i>
                                    <h4>הבקשה נשלחה בהצלחה!</h4>
                                    <p className="text-muted mt-2">הבקשה ממתינה לאישור קפטן/בעלים או מנהל.</p>
                                </div>
                            ) : step === 'team' ? (
                                <>
                                    <p className="mb-4 text-muted">בחר את הקבוצה שאתה חלק ממנה.</p>
                                    <div className="mb-4">
                                        <label htmlFor="claim-team-select" className="form-label fw-bold">קבוצה</label>
                                        <select
                                            id="claim-team-select"
                                            className="form-select form-select-lg"
                                            value={selectedTeamId}
                                            onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : '')}
                                            required
                                            aria-required="true"
                                        >
                                            <option value="">- בחירת קבוצה -</option>
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    {error && <div className="alert alert-danger py-2">{error}</div>}
                                    <div className="d-grid">
                                        <button className="btn btn-theme-green btn-lg" onClick={handleTeamNext} disabled={!selectedTeamId || loadingPlayers}>
                                            {loadingPlayers ? <span className="spinner-border spinner-border-sm" /> : 'המשך'}
                                        </button>
                                    </div>
                                </>
                            ) : step === 'player' ? (
                                <>
                                    <p className="mb-3 text-muted">בחר את השחקן שאתה. שחקנים שכבר נתבעו על ידי משתמשים אחרים אינם מופיעים.</p>
                                    <div className="row g-2 mb-4" style={{ maxHeight: 340, overflowY: 'auto' }}>
                                        {availablePlayers.map(p => {
                                            const isSelected = selectedMemberId === p.memberId;
                                            return (
                                                <div key={p.memberId} className="col-6 col-md-4">
                                                    <button
                                                        type="button"
                                                        className={`card h-100 text-center p-3 position-relative w-100 border${isSelected ? ' player-card-sel' : ''}`}
                                                        aria-pressed={isSelected}
                                                        onClick={() => setSelectedMemberId(p.memberId)}
                                                    >
                                                        {isSelected && (
                                                            <span className="position-absolute top-0 end-0 m-1 text-theme-green" style={{ fontSize: '1rem', zIndex: 1 }}>✓</span>
                                                        )}
                                                        <div className="fw-bold">{p.firstName} {p.lastName}</div>
                                                        <div className="d-flex justify-content-center gap-1 flex-wrap mt-1">
                                                            <span className="badge bg-theme-green">#{p.number}</span>
                                                            {p.position && <span className="badge bg-secondary">{p.position}</span>}
                                                            {p.isCaptain && <span className="badge bg-warning text-dark">קפטן</span>}
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="border-top pt-3 mb-2">
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => {
                                                setSelectedMemberId(null);
                                                setStep('custom');
                                            }}
                                        >
                                            <i className="bi bi-plus-circle me-1" />אני לא ברשימה — צור פרופיל חדש
                                        </button>
                                    </div>
                                    {error && <div className="alert alert-danger py-2">{error}</div>}
                                    <div className="d-flex gap-2 mt-3">
                                        <button className="btn btn-secondary" onClick={() => setStep('team')}>חזור</button>
                                        <button
                                            className="btn btn-theme-green ms-auto"
                                            onClick={handleSubmitClaim}
                                            disabled={!selectedMemberId || loading}
                                        >
                                            {loading ? <span className="spinner-border spinner-border-sm" /> : 'חבר אותי לשחקן שימושי'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <form onSubmit={handleSubmitCustom}>
                                    <p className="mb-3 text-muted">
                                        {availablePlayers.length === 0
                                            ? 'אין שחקנים פנויים בקבוצה זו. מלא את הפרטים שלך ובקשתך תועבר לאישור.'
                                            : 'מלא את הפרטים שלך כשחקן חדש.'}
                                    </p>
                                    <div className="row g-3">
                                        <div className="col-6">
                                            <label className="form-label">שם פרטי *</label>
                                            <input className="form-control" value={customProfile.firstName} maxLength={50}
                                                onChange={e => setCustomProfile(p => ({ ...p, firstName: e.target.value }))} required />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label">שם משפחה *</label>
                                            <input className="form-control" value={customProfile.lastName} maxLength={50}
                                                onChange={e => setCustomProfile(p => ({ ...p, lastName: e.target.value }))} required />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label">כינוי / תג (ריק = שם משפחה)</label>
                                            <input className="form-control" value={customProfile.nickname} maxLength={50}
                                                onChange={e => setCustomProfile(p => ({ ...p, nickname: e.target.value }))} />
                                        </div>
                                        <div className="col-3">
                                            <label className="form-label">מספר חולצה *</label>
                                            <input type="number" className="form-control" value={customProfile.number} min={1} max={99}
                                                onChange={e => setCustomProfile(p => ({ ...p, number: e.target.value }))} required />
                                        </div>
                                        <div className="col-3">
                                            <label className="form-label">עמדה</label>
                                            <select className="form-select" value={customProfile.position}
                                                onChange={e => setCustomProfile(p => ({ ...p, position: e.target.value }))}>
                                                <option value="">—</option>
                                                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    {error && <div className="alert alert-danger py-2 mt-3">{error}</div>}
                                    <div className="d-flex gap-2">
                                        <button type="button" className="btn btn-secondary" onClick={() => setStep(availablePlayers.length > 0 ? 'player' : 'team')}>חזור</button>
                                        <button type="submit" className="btn btn-theme-green ms-auto" disabled={loading}>
                                            {loading ? <span className="spinner-border spinner-border-sm" /> : 'שלח בקשה'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
        </AccessibleModal>
    );
};

export default PlayerClaimModal;
