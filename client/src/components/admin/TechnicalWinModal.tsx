import { useState } from 'react';
import AccessibleModal from '../AccessibleModal';
import type { Match, Team } from '../../types';

interface TechnicalWinModalProps {
    match: Match;
    teams: Team[];
    onClose: () => void;
    onSubmit: (winnerTeamId: number) => Promise<void>;
}

const TechnicalWinModal = ({ match, teams, onClose, onSubmit }: TechnicalWinModalProps) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const getTeamName = (id: number) => teams.find(t => t.id === id)?.name ?? `קבוצה ${id}`;
    const titleId = 'technical-win-modal-title';

    const handlePick = async (winnerTeamId: number) => {
        setError('');
        setLoading(true);
        try {
            await onSubmit(winnerTeamId);
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error && err.message
                ? err.message
                : 'שגיאה ברישום ניצחון טכני';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AccessibleModal open onClose={onClose} titleId={titleId} className="add-goal-modal" centered={false}>
            <div className="modal-content add-goal-modal-content">
                <div className="modal-header">
                    <h2 id={titleId} className="modal-title fw-bold h5">ניצחון טכני</h2>
                    <button type="button" className="btn-close" onClick={onClose} aria-label="סגור" />
                </div>
                <div className="modal-body add-goal-modal-body">
                    <p className="text-muted mb-3">
                        התוצאה תישאר 0:0 ללא שערים. הקבוצה שנבחרת תקבל 3 נקודות בטבלה, והמשחק יוצג כהסתיים.
                    </p>
                    <div className="add-goal-team-grid">
                        <button
                            type="button"
                            className="add-goal-team-card"
                            disabled={loading}
                            onClick={() => handlePick(match.team1Id)}
                        >
                            <span className="add-goal-team-name">{getTeamName(match.team1Id)}</span>
                            <span className="add-goal-team-side text-muted">מנצחת טכנית</span>
                        </button>
                        <button
                            type="button"
                            className="add-goal-team-card"
                            disabled={loading}
                            onClick={() => handlePick(match.team2Id)}
                        >
                            <span className="add-goal-team-name">{getTeamName(match.team2Id)}</span>
                            <span className="add-goal-team-side text-muted">מנצחת טכנית</span>
                        </button>
                    </div>
                    {error && <div className="alert alert-danger py-2 mt-3" role="alert">{error}</div>}
                    {loading && (
                        <div className="text-center mt-3" role="status">
                            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                            <span className="visually-hidden">שומר…</span>
                        </div>
                    )}
                </div>
            </div>
        </AccessibleModal>
    );
};

export default TechnicalWinModal;
