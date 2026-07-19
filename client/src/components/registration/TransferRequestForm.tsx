import { useCallback, useEffect, useState } from 'react';
import { registrationAPI, type TournamentSlug } from '../../api/client';

interface AvailableTeam {
    id: number;
    name: string;
}

interface Props {
    slug: TournamentSlug;
    currentTeamId: number;
    onSubmitted?: () => void;
}

export default function TransferRequestForm({ slug, currentTeamId, onSubmitted }: Props) {
    const [teams, setTeams] = useState<AvailableTeam[]>([]);
    const [targetId, setTargetId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [loadErr, setLoadErr] = useState('');
    const [submitErr, setSubmitErr] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setLoadErr('');
        try {
            const res = await registrationAPI.listAvailableTeams(slug);
            const list = (Array.isArray(res.data) ? res.data : []) as AvailableTeam[];
            setTeams(list.filter((t) => t.id !== currentTeamId));
        } catch {
            setTeams([]);
            setLoadErr('שגיאה בטעינת קבוצות');
        } finally {
            setLoading(false);
        }
    }, [slug, currentTeamId]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const toTeamId = Number(targetId);
        if (!toTeamId) {
            setSubmitErr('בחר קבוצת יעד');
            return;
        }
        setSubmitting(true);
        setMsg('');
        setSubmitErr('');
        try {
            await registrationAPI.submitTransfer(toTeamId, slug);
            setMsg('בקשת ההעברה נשלחה וממתינה לאישור מנהל.');
            setTargetId('');
            onSubmitted?.();
        } catch (e: unknown) {
            const ax = e as { response?: { data?: { error?: string } } };
            setSubmitErr(ax.response?.data?.error || 'שגיאה בשליחת בקשת העברה');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <p className="small text-muted mb-0">טוען קבוצות…</p>;
    }

    if (loadErr) {
        return (
            <div className="mb-0">
                <p className="small text-danger mb-2" role="alert">
                    {loadErr}
                </p>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void load()}>
                    נסה שוב
                </button>
            </div>
        );
    }

    if (teams.length === 0) {
        return null;
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 pt-3 border-top">
            <h4 className="h6 fw-bold mb-2">בקשת העברה לקבוצה אחרת</h4>
            <p className="small text-muted mb-2">
                ניתן להחזיק בקשת העברה אחת בלבד. המנהל יאשר את המעבר.
            </p>
            <div className="d-flex flex-wrap gap-2 align-items-end">
                <div className="flex-grow-1" style={{ minWidth: 180 }}>
                    <label className="form-label small mb-1" htmlFor={`transfer-target-${slug}`}>
                        קבוצת יעד
                    </label>
                    <select
                        id={`transfer-target-${slug}`}
                        className="form-select form-select-sm"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                    >
                        <option value="">בחר קבוצה</option>
                        {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>
                <button type="submit" className="btn btn-sm btn-outline-primary" disabled={submitting}>
                    {submitting ? 'שולח…' : 'שלח בקשת העברה'}
                </button>
            </div>
            {submitErr && (
                <p className="small text-danger mt-2 mb-0" role="alert">
                    {submitErr}
                </p>
            )}
            {msg && (
                <p className="small text-success mt-2 mb-0" role="status">
                    {msg}
                </p>
            )}
        </form>
    );
}
