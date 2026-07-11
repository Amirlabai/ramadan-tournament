import { useState, useEffect, useRef, useCallback } from 'react';
import AccessibleModal from '../AccessibleModal';
import type { Match, Team } from '../../types';
import './AddGoalWizardModal.css';

export type AddGoalSubmit =
    | { kind: 'player'; memberId: number; teamId: number }
    | { kind: 'ownGoal'; creditedTeamId: number };

interface AddGoalWizardModalProps {
    match: Match;
    teams: Team[];
    onClose: () => void;
    onSubmit: (payload: AddGoalSubmit) => Promise<void>;
}

const SUCCESS_CLOSE_MS = 1500;

const AddGoalWizardModal = ({ match, teams, onClose, onSubmit }: AddGoalWizardModalProps) => {
    const [step, setStep] = useState<'team' | 'player'>('team');
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
    const [ownGoalSelected, setOwnGoalSelected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCloseTimer = useCallback(() => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);

    const handleClose = useCallback(() => {
        clearCloseTimer();
        onClose();
    }, [clearCloseTimer, onClose]);

    useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

    const getTeamName = (id: number) => teams.find(t => t.id === id)?.name ?? `קבוצה ${id}`;
    const team1Name = getTeamName(match.team1Id);
    const team2Name = getTeamName(match.team2Id);

    const selectedTeam = selectedTeamId
        ? teams.find(t => t.id === selectedTeamId)
        : null;
    const players = selectedTeam?.players ?? [];

    const handleTeamSelect = (teamId: number) => {
        setSelectedTeamId(teamId);
        setSelectedMemberId(null);
        setOwnGoalSelected(false);
        setError('');
        setStep('player');
    };

    const handleSubmit = async () => {
        if (!selectedTeamId) {
            setError('יש לבחור קבוצה');
            return;
        }
        if (!ownGoalSelected && !selectedMemberId) {
            setError('יש לבחור שחקן או גול עצמי');
            return;
        }
        setError('');
        setLoading(true);
        try {
            if (ownGoalSelected) {
                await onSubmit({ kind: 'ownGoal', creditedTeamId: selectedTeamId });
            } else {
                await onSubmit({ kind: 'player', memberId: selectedMemberId!, teamId: selectedTeamId });
            }
            setSuccess(true);
            clearCloseTimer();
            closeTimerRef.current = setTimeout(handleClose, SUCCESS_CLOSE_MS);
        } catch (err: unknown) {
            const message = err instanceof Error && err.message
                ? err.message
                : 'שגיאה בהוספת השער';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const modalTitleId = 'add-goal-modal-title';
    const scoreDisplay = `${match.score1 ?? '—'} : ${match.score2 ?? '—'}`;
    const canSubmit = ownGoalSelected || (selectedMemberId != null && players.length > 0);

    return (
        <AccessibleModal open onClose={handleClose} titleId={modalTitleId} className="add-goal-modal">
            <div className="modal-content add-goal-modal-content">
                <div className="modal-header">
                    <h2 id={modalTitleId} className="modal-title fw-bold h5">
                        {success
                            ? 'השער נוסף בהצלחה'
                            : step === 'team'
                                ? 'הוסף שער — בחר קבוצה'
                                : `הוסף שער — ${getTeamName(selectedTeamId!)}`}
                    </h2>
                    <button type="button" className="btn-close" onClick={handleClose} aria-label="סגור" />
                </div>

                <div className="modal-body add-goal-modal-body">
                    {success ? (
                        <div className="text-center text-theme-green py-4" role="status">
                            <i className="bi bi-check-circle-fill display-4 mb-3" aria-hidden="true" />
                            <p className="mb-0">השער נשמר במשחק.</p>
                        </div>
                    ) : step === 'team' ? (
                        <>
                            <p className="add-goal-match-summary text-muted mb-3">
                                {team1Name} <span className="fw-bold">{scoreDisplay}</span> {team2Name}
                            </p>
                            <p className="mb-3 text-muted">לזכות מי?</p>
                            <div className="add-goal-team-grid">
                                <button
                                    type="button"
                                    className="add-goal-team-card"
                                    onClick={() => handleTeamSelect(match.team1Id)}
                                >
                                    <span className="add-goal-team-name">{team1Name}</span>
                                    <span className="add-goal-team-side text-muted">קבוצה 1</span>
                                </button>
                                <button
                                    type="button"
                                    className="add-goal-team-card"
                                    onClick={() => handleTeamSelect(match.team2Id)}
                                >
                                    <span className="add-goal-team-name">{team2Name}</span>
                                    <span className="add-goal-team-side text-muted">קבוצה 2</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="mb-3 text-muted">מי הבקיע?</p>
                            <div className="row g-2 add-goal-player-grid mb-3">
                                <div className="col-12">
                                    <button
                                        type="button"
                                        className={`add-goal-player-card w-100${ownGoalSelected ? ' selected' : ''}`}
                                        aria-pressed={ownGoalSelected}
                                        onClick={() => {
                                            setOwnGoalSelected(true);
                                            setSelectedMemberId(null);
                                            setError('');
                                        }}
                                    >
                                        {ownGoalSelected && (
                                            <span className="add-goal-player-check" aria-hidden="true">✓</span>
                                        )}
                                        <span className="fw-bold">גול עצמי</span>
                                        <span className="text-muted small d-block mt-1">
                                            נזקף לטובת {getTeamName(selectedTeamId!)} ללא כובש
                                        </span>
                                    </button>
                                </div>
                                {players.length === 0 ? (
                                    <div className="col-12">
                                        <p className="text-muted mb-0">אין שחקנים רשומים בקבוצה זו — ניתן לבחור גול עצמי בלבד.</p>
                                    </div>
                                ) : (
                                    players.map(p => {
                                        const isSelected = !ownGoalSelected && selectedMemberId === p.memberId;
                                        const label = p.nickname || `${p.firstName} ${p.lastName}`;
                                        return (
                                            <div key={p.memberId} className="col-12 col-sm-6">
                                                <button
                                                    type="button"
                                                    className={`add-goal-player-card w-100${isSelected ? ' selected' : ''}`}
                                                    aria-pressed={isSelected}
                                                    onClick={() => {
                                                        setSelectedMemberId(p.memberId);
                                                        setOwnGoalSelected(false);
                                                        setError('');
                                                    }}
                                                >
                                                    {isSelected && (
                                                        <span className="add-goal-player-check" aria-hidden="true">✓</span>
                                                    )}
                                                    <span className="fw-bold">{label}</span>
                                                    {p.number > 0 && (
                                                        <span className="badge bg-theme-green mt-1">#{p.number}</span>
                                                    )}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
                            <div className="add-goal-footer d-flex gap-2">
                                <button
                                    type="button"
                                    className="btn btn-secondary add-goal-btn"
                                    onClick={() => {
                                        setStep('team');
                                        setSelectedTeamId(null);
                                        setSelectedMemberId(null);
                                        setOwnGoalSelected(false);
                                        setError('');
                                    }}
                                >
                                    חזור
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-theme-green add-goal-btn ms-auto"
                                    onClick={handleSubmit}
                                    disabled={!canSubmit || loading}
                                    aria-busy={loading}
                                    aria-label="הוסף שער"
                                >
                                    {loading && (
                                        <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                                    )}
                                    הוסף שער
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AccessibleModal>
    );
};

export default AddGoalWizardModal;
