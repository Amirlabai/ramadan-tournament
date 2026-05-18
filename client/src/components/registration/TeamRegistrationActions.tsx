import { useCallback, useEffect, useState } from 'react';
import { registrationAPI, type TournamentSlug } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

type PendingJoin = {
    id: string;
    user: { displayName: string; email?: string | null };
};

interface Props {
    teamId: number;
    teamName: string;
    slug: TournamentSlug;
}

export default function TeamRegistrationActions({ teamId, teamName, slug }: Props) {
    const { user, refreshUser } = useAuth();
    const [joinMsg, setJoinMsg] = useState('');
    const [ownerMsg, setOwnerMsg] = useState('');
    const [pending, setPending] = useState<PendingJoin[]>([]);
    const [loadingPending, setLoadingPending] = useState(false);
    const [actingId, setActingId] = useState<string | null>(null);

    const reg = user?.tournamentRegistration?.[slug];
    const isOwner = reg?.ownedTeamId === teamId;
    const onRoster = !!reg?.onRoster;
    const canJoin = !!user && !onRoster && !isOwner;

    const loadPending = useCallback(async () => {
        if (!isOwner) return;
        setLoadingPending(true);
        try {
            const res = await registrationAPI.listOwnerJoinRequests(teamId, slug);
            setPending(Array.isArray(res.data) ? res.data : []);
        } catch {
            setPending([]);
        } finally {
            setLoadingPending(false);
        }
    }, [isOwner, teamId, slug]);

    useEffect(() => {
        void loadPending();
    }, [loadPending]);

    const handleJoinRequest = async () => {
        if (!user) {
            setJoinMsg('יש להתחבר כדי לבקש הצטרפות');
            return;
        }
        setJoinMsg('');
        try {
            await registrationAPI.submitJoin(teamId, slug);
            setJoinMsg('בקשת ההצטרפות נשלחה. לאחר תשלום — הזן את מספר החשבונית בפרופיל.');
            await refreshUser();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setJoinMsg(ax.response?.data?.error || 'שגיאה בשליחת הבקשה');
        }
    };

    const handleOwnerReview = async (requestId: string, approve: boolean) => {
        setActingId(requestId);
        setOwnerMsg('');
        try {
            await registrationAPI.ownerReviewJoin(teamId, requestId, approve, slug);
            setOwnerMsg(approve ? 'הבקשה אושרה וממתינה לאישור מנהל.' : 'הבקשה נדחה.');
            await loadPending();
            await refreshUser();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setOwnerMsg(ax.response?.data?.error || 'שגיאה בעדכון הבקשה');
        } finally {
            setActingId(null);
        }
    };

    if (!user) return null;

    return (
        <div className="mb-3" role="region" aria-label={`פעולות רישום — ${teamName}`}>
            {canJoin && (
                <div>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={() => void handleJoinRequest()}
                        aria-label={`בקש להצטרף ל${teamName}`}
                    >
                        בקש להצטרף לקבוצה
                    </button>
                    {joinMsg && (
                        <p className="small text-muted mt-2 mb-0" role="status" aria-live="polite">
                            {joinMsg}
                        </p>
                    )}
                </div>
            )}

            {isOwner && (
                <div className="border rounded p-3 bg-white">
                    <h3 className="h6 fw-bold mb-2">בקשות הצטרפות (אישור בעלים)</h3>
                    {ownerMsg && (
                        <p className="small alert alert-info py-2" role="status" aria-live="polite">
                            {ownerMsg}
                        </p>
                    )}
                    {loadingPending ? (
                        <span className="spinner-border spinner-border-sm text-success" aria-hidden="true" />
                    ) : pending.length === 0 ? (
                        <p className="text-muted small mb-0">אין בקשות ממתינות</p>
                    ) : (
                        <ul className="list-unstyled mb-0">
                            {pending.map((row) => (
                                <li
                                    key={row.id}
                                    className="d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 border-bottom"
                                >
                                    <span>
                                        {row.user.displayName}
                                        {row.user.email ? (
                                            <span className="text-muted small ms-1" dir="ltr">
                                                ({row.user.email})
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="d-flex gap-1">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-success"
                                            disabled={actingId === row.id}
                                            onClick={() => void handleOwnerReview(row.id, true)}
                                        >
                                            אשר
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger"
                                            disabled={actingId === row.id}
                                            onClick={() => void handleOwnerReview(row.id, false)}
                                        >
                                            דחה
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

