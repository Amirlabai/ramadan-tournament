import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { registrationAPI, teamsAPI, type TournamentSlug } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useCancelRegistrationRequest } from '../../hooks/useCancelRegistrationRequest';
import { useNavActionIndicators } from '../../contexts/NavActionIndicatorsContext';
import { trackEvent } from '../../utils/analytics';

type PendingJoin = {
    id: string;
    user: { displayName: string; email?: string | null };
};

type AvailablePlayer = {
    memberId: number;
    firstName: string;
    lastName: string;
    nickname: string;
    number: number;
    position: string;
};

interface Props {
    teamId: number;
    teamName: string;
    slug: TournamentSlug;
}

export default function TeamRegistrationActions({ teamId, teamName, slug }: Props) {
    const { user, refreshUser } = useAuth();
    const { refreshIndicators } = useNavActionIndicators();
    const [joinMsg, setJoinMsg] = useState('');
    const [ownerMsg, setOwnerMsg] = useState('');
    const [pending, setPending] = useState<PendingJoin[]>([]);
    const [loadingPending, setLoadingPending] = useState(false);
    const [actingId, setActingId] = useState<string | null>(null);
    const [joinStep, setJoinStep] = useState<'idle' | 'pick-slot'>('idle');
    const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
    const [loadingJoin, setLoadingJoin] = useState(false);
    const { cancelRegistrationRequest, cancelling } = useCancelRegistrationRequest(slug);

    const reg =
        slug === 'boys' || slug === 'girls' ? user?.tournamentRegistration?.[slug] : undefined;
    const isOwner = reg?.ownedTeamId === teamId;
    const onRoster = !!reg?.onRoster;
    const pendingJoin = reg?.pendingJoin;
    const pendingCreation = reg?.pendingCreation;
    const isPaid = reg?.status === 'active';
    const canJoin =
        !!user && isPaid && !onRoster && !isOwner && !pendingJoin && !pendingCreation;
    const needsIdentity =
        !!user && !isPaid && !onRoster && !isOwner && !pendingJoin && !pendingCreation;
    // Pre-identity rows: pending request without active registration
    const legacyNeedsIdentity =
        !!user && !isPaid && !onRoster && !isOwner && !!(pendingJoin || pendingCreation);

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

    const resetJoinFlow = () => {
        setJoinStep('idle');
        setAvailablePlayers([]);
        setSelectedMemberId(null);
    };

    const handleJoinRequest = async () => {
        if (!user) {
            setJoinMsg('יש להתחבר כדי לבקש הצטרפות');
            return;
        }
        setJoinMsg('');
        trackEvent('join_request_click', {
            category: 'registration',
            properties: { division: slug, teamId },
        });
        setLoadingJoin(true);
        try {
            const res = await teamsAPI.getAvailablePlayers(teamId, slug);
            const slots = Array.isArray(res.data) ? res.data : [];
            if (slots.length > 0) {
                setAvailablePlayers(slots);
                setSelectedMemberId(slots[0]?.memberId ?? null);
                setJoinStep('pick-slot');
                return;
            }
            await registrationAPI.submitJoin(teamId, slug);
            setJoinMsg('בקשת ההצטרפות נשלחה וממתינה לאישור.');
            resetJoinFlow();
            await refreshUser();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setJoinMsg(ax.response?.data?.error || 'שגיאה בשליחת הבקשה');
        } finally {
            setLoadingJoin(false);
        }
    };

    const handleSubmitSlotJoin = async () => {
        if (!selectedMemberId) {
            setJoinMsg('יש לבחור שחקן מהרשימה');
            return;
        }
        setJoinMsg('');
        setLoadingJoin(true);
        try {
            await registrationAPI.submitJoin(teamId, slug, { memberId: selectedMemberId });
            setJoinMsg('בקשת ההצטרפות נשלחה וממתינה לאישור.');
            resetJoinFlow();
            await refreshUser();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setJoinMsg(ax.response?.data?.error || 'שגיאה בשליחת הבקשה');
        } finally {
            setLoadingJoin(false);
        }
    };

    const handleCancelRequest = async () => {
        setJoinMsg('');
        const result = await cancelRegistrationRequest('לבטל את הבקשה הפעילה?');
        if (result.ok) {
            setJoinMsg('הבקשה בוטלה.');
        } else if (result.error) {
            setJoinMsg(result.error);
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
            await refreshIndicators();
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
                    {joinStep === 'pick-slot' ? (
                        <div className="border rounded p-3 bg-white">
                            <p className="small text-muted mb-2">
                                נמצאו שחקנים פנויים ב{teamName}. בחר את הרשומה שלך לפני שליחת הבקשה.
                            </p>
                            <fieldset>
                                <legend className="form-label fw-bold small mb-2">שחקן מהסגל</legend>
                                <div className="d-flex flex-column gap-2 mb-3">
                                    {availablePlayers.map((player) => (
                                        <label
                                            key={player.memberId}
                                            className="d-flex align-items-center gap-2 small mb-0"
                                        >
                                            <input
                                                type="radio"
                                                name={`join-slot-${teamId}`}
                                                value={player.memberId}
                                                checked={selectedMemberId === player.memberId}
                                                onChange={() => setSelectedMemberId(player.memberId)}
                                            />
                                            <span>
                                                {player.nickname} ({player.firstName} {player.lastName}) — #{player.number}
                                                {player.position ? ` · ${player.position}` : ''}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <div className="d-flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-success"
                                    onClick={() => void handleSubmitSlotJoin()}
                                    disabled={loadingJoin || !selectedMemberId}
                                >
                                    {loadingJoin ? 'שולח…' : 'שלח בקשת הצטרפות'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={resetJoinFlow}
                                    disabled={loadingJoin}
                                >
                                    ביטול
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() => void handleJoinRequest()}
                            disabled={loadingJoin}
                            aria-label={`בקש להצטרף ל${teamName}`}
                        >
                            {loadingJoin ? 'טוען…' : 'בקש להצטרף לקבוצה'}
                        </button>
                    )}
                    {joinMsg && (
                        <p className="small text-muted mt-2 mb-0" role="status" aria-live="polite">
                            {joinMsg}
                        </p>
                    )}
                </div>
            )}

            {needsIdentity && (
                <p className="small text-muted mb-0">
                    להצטרפות לקבוצה המנהל ירשום תחילה את תעודת הזהות ושנת הלידה, ואז יש להזין בדיוק את אותם פרטים ב
                    <Link to="/profile" className="ms-1">
                        פרופיל
                    </Link>
                    . פרטים נשמרים לפי{' '}
                    <Link to="/privacy#identity">מדיניות הפרטיות</Link>.
                </p>
            )}

            {pendingCreation && !onRoster && !isOwner && (
                <div className="small text-warning mb-2">
                    <p className="mb-2">
                        יש לך בקשת הקמת קבוצה &quot;{pendingCreation.teamName}&quot; פעילה. בטל אותה כדי
                        לבקש הצטרפות לקבוצה זו.
                    </p>
                    {legacyNeedsIdentity && (
                        <p className="mb-2 text-muted">
                            המנהל ירשום את תעודת הזהות ושנת הלידה, ואז יש להזין בדיוק את אותם פרטים ב
                            <Link to="/profile" className="ms-1">
                                פרופיל
                            </Link>
                            לפני אישור המנהל. פרטים נשמרים לפי{' '}
                            <Link to="/privacy#identity">מדיניות הפרטיות</Link>.
                        </p>
                    )}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => void handleCancelRequest()}
                        disabled={cancelling}
                    >
                        {cancelling ? 'מבטל…' : 'בטל בקשת הקמת קבוצה'}
                    </button>
                    {joinMsg && (
                        <p className="small text-muted mt-2 mb-0" role="status" aria-live="polite">
                            {joinMsg}
                        </p>
                    )}
                </div>
            )}

            {pendingJoin && !onRoster && !isOwner && (
                <div className="small text-warning mb-2">
                    <p className="mb-2">
                        בקשת הצטרפות לקבוצה #{pendingJoin.teamId} בתהליך
                        {pendingJoin.status === 'owner_approved'
                            ? ' (אושרה על ידי הבעלים, ממתין למנהל)'
                            : ' (ממתין לאישור בעלים)'}
                        .
                    </p>
                    {legacyNeedsIdentity && (
                        <p className="mb-2 text-muted">
                            המנהל ירשום את תעודת הזהות ושנת הלידה, ואז יש להזין בדיוק את אותם פרטים ב
                            <Link to="/profile" className="ms-1">
                                פרופיל
                            </Link>
                            לפני אישור המנהל. פרטים נשמרים לפי{' '}
                            <Link to="/privacy#identity">מדיניות הפרטיות</Link>.
                        </p>
                    )}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => void handleCancelRequest()}
                        disabled={cancelling}
                    >
                        {cancelling ? 'מבטל…' : 'בטל בקשת הצטרפות'}
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
