import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { adminAPI, type TournamentSlug } from '../../api/client';

interface CaptainCandidate {
    memberId: number;
    firstName: string;
    lastName: string;
    nickname: string;
    number: number;
    isCaptain: boolean;
    hasLinkedUser: boolean;
}

interface Props {
    teamId: number;
    teamName: string;
    slug: TournamentSlug;
    onSaved?: () => void;
}

function playerLabel(p: Pick<CaptainCandidate, 'firstName' | 'lastName' | 'nickname' | 'number'>): string {
    const name = `${p.firstName} ${p.lastName}`.trim();
    const nick = p.nickname?.trim() && p.nickname.trim() !== p.lastName.trim()
        ? ` (${p.nickname.trim()})`
        : '';
    return `${name}${nick} #${p.number}`;
}

export default function AdminCaptainPicker({ teamId, teamName, slug, onSaved }: Props) {
    const selectId = useId();
    const [candidates, setCandidates] = useState<CaptainCandidate[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadErr, setLoadErr] = useState('');
    const [actionErr, setActionErr] = useState('');
    const [msg, setMsg] = useState('');

    const loadCandidates = useCallback(async () => {
        setLoading(true);
        setLoadErr('');
        setActionErr('');
        try {
            const res = await adminAPI.getCaptainCandidates(teamId, slug);
            const list = (res.data?.candidates ?? []) as CaptainCandidate[];
            setCandidates(list);
            const current = list.find((c) => c.isCaptain);
            setSelectedMemberId(current ? String(current.memberId) : '');
        } catch (e: unknown) {
            const ax = e as { response?: { data?: { error?: string } } };
            setLoadErr(ax.response?.data?.error || 'לא ניתן לטעון את רשימת השחקנים');
            setCandidates([]);
        } finally {
            setLoading(false);
        }
    }, [teamId, slug]);

    useEffect(() => {
        void loadCandidates();
    }, [loadCandidates]);

    const currentCaptain = useMemo(
        () => candidates.find((c) => c.isCaptain) ?? null,
        [candidates]
    );

    const selected = useMemo(() => {
        const id = Number(selectedMemberId);
        if (!Number.isInteger(id) || id < 1) return null;
        return candidates.find((c) => c.memberId === id) ?? null;
    }, [candidates, selectedMemberId]);

    const showUnlinkedWarning = !!selected && !selected.hasLinkedUser;

    const handleSave = async () => {
        if (!selected) {
            setActionErr('יש לבחור שחקן');
            return;
        }
        // Submit is disabled when selected.isCaptain; server still no-ops if already captain.

        const oldName = currentCaptain ? playerLabel(currentCaptain) : 'אין קפטן כרגע';
        const newName = playerLabel(selected);
        const linkedNote = selected.hasLinkedUser
            ? ''
            : '\n\nשים לב: לשחקן אין חשבון מקושר. התואר יישמר, אך ניהול מקוון של הקבוצה יתחיל רק אחרי שהשחקן ישייך את הפרופיל.';

        if (
            !confirm(
                `להגדיר את ${newName} כקפטן של "${teamName}" במקום ${oldName}?${linkedNote}`
            )
        ) {
            return;
        }

        setSaving(true);
        setActionErr('');
        setMsg('');
        try {
            const res = await adminAPI.setTeamCaptain(teamId, selected.memberId, slug);
            setMsg(res.data?.message || 'הקפטן עודכן');
            await loadCandidates();
            onSaved?.();
        } catch (e: unknown) {
            const ax = e as { response?: { data?: { error?: string } } };
            setActionErr(ax.response?.data?.error || 'שגיאה בעדכון הקפטן');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="admin-captain-picker mb-3"
            role="region"
            aria-label={`ניהול קפטן — ${teamName}`}
        >
            <h4 className="admin-captain-picker__title h6 fw-bold mb-2">ניהול קפטן</h4>

            {loading ? (
                <p className="small text-muted mb-0" role="status">
                    טוען רשימת שחקנים…
                </p>
            ) : loadErr ? (
                <p className="small text-danger mb-2" role="alert">
                    {loadErr}
                </p>
            ) : candidates.length === 0 ? (
                <p className="small text-muted mb-0">אין שחקנים פעילים בסגל. הוסף שחקן ואז בחר קפטן.</p>
            ) : (
                <>
                    <p className="small mb-2">
                        <span className="text-muted">קפטן נוכחי: </span>
                        <strong>
                            {currentCaptain ? playerLabel(currentCaptain) : 'לא הוגדר'}
                        </strong>
                        {currentCaptain && !currentCaptain.hasLinkedUser ? (
                            <span className="admin-captain-picker__badge ms-2">ללא חשבון מקושר</span>
                        ) : null}
                    </p>

                    <div className="admin-captain-picker__controls">
                        <label className="form-label small mb-1" htmlFor={selectId}>
                            בחר שחקן לקפטן
                        </label>
                        <div className="d-flex flex-wrap align-items-stretch gap-2">
                            <select
                                id={selectId}
                                className="form-select admin-captain-picker__select"
                                value={selectedMemberId}
                                disabled={saving}
                                onChange={(e) => {
                                    setSelectedMemberId(e.target.value);
                                    setActionErr('');
                                    setMsg('');
                                }}
                            >
                                <option value="">— בחר שחקן —</option>
                                {candidates.map((c) => (
                                    <option key={c.memberId} value={c.memberId}>
                                        {playerLabel(c)}
                                        {c.isCaptain ? ' (קפטן)' : ''}
                                        {c.hasLinkedUser ? '' : ' · ללא חשבון'}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="btn btn-theme-green admin-captain-picker__submit"
                                disabled={saving || !selected || selected.isCaptain}
                                onClick={() => void handleSave()}
                            >
                                {saving ? (
                                    <>
                                        <span
                                            className="spinner-border spinner-border-sm me-1"
                                            aria-hidden="true"
                                        />
                                        מעדכן…
                                    </>
                                ) : (
                                    'הגדר כקפטן'
                                )}
                            </button>
                        </div>
                    </div>

                    {showUnlinkedWarning ? (
                        <p className="admin-captain-picker__warning small mt-2 mb-0" role="status">
                            לשחקן זה אין חשבון מקושר. התואר יישמר, אך הרשאות ניהול מקוון
                            (לוגו, סגל, אישור הצטרפות) יתחילו רק אחרי שהשחקן ישייך את הפרופיל.
                        </p>
                    ) : null}

                    {actionErr ? (
                        <p className="small text-danger mt-2 mb-0" role="alert">
                            {actionErr}
                        </p>
                    ) : null}
                    {msg ? (
                        <p className="small text-success mt-2 mb-0" role="status">
                            {msg}
                        </p>
                    ) : null}
                </>
            )}
        </div>
    );
}
