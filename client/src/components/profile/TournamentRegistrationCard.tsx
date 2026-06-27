import { useCallback, useEffect, useState } from 'react';
import { usersAPI, type TournamentSlug } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useCancelRegistrationRequest } from '../../hooks/useCancelRegistrationRequest';
import TransferRequestForm from '../registration/TransferRequestForm';
import './TournamentRegistrationCard.css';

const STATUS_LABELS: Record<string, string> = {
    none: 'שלב 1: הזן תעודת זהות ושנת לידה או המתן שהמנהל ירשום',
    join_pending: 'בקשה בתהליך',
    awaiting_invoice: 'ממתין לאישור מנהל (הזנת זהות)',
    invoice_assigned: 'המנהל רשם את פרטיך — הזן את אותם פרטים בדיוק להפעלה',
    active: 'רישום פעיל — ניתן לשלוח בקשת הצטרפות או הקמת קבוצה',
    archived: 'עונה בארכיון',
};

interface RegistrationSummary {
    seasonId: string;
    division: string;
    status: string;
    invoiceAlert?: string | null;
    awaitingAdminIdentity?: boolean;
    pendingJoin?: { id: string; teamId: number; status: string } | null;
    pendingCreation?: { id: string; teamName: string; status: string } | null;
    pendingTransfer?: { fromTeamId: number; toTeamId: number } | null;
    onRoster?: { teamId: number; memberId: number } | null;
}

interface Props {
    slug: TournamentSlug;
    title: string;
}

export default function TournamentRegistrationCard({ slug, title }: Props) {
    const { user, refreshUser } = useAuth();
    const [reg, setReg] = useState<RegistrationSummary | null>(null);
    const [personalId, setPersonalId] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { cancelRegistrationRequest, cancelling } = useCancelRegistrationRequest(slug);

    const load = useCallback(async (): Promise<RegistrationSummary | null> => {
        if (!user) return null;
        setLoading(true);
        try {
            const res = await usersAPI.getRegistration(slug);
            const data = res.data as RegistrationSummary;
            setReg(data);
            return data;
        } catch {
            setReg(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, [user, slug]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleSubmitIdentity = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setMsg('');
        setErr('');
        try {
            await usersAPI.verifyIdentity(personalId.trim(), birthYear.trim(), slug);
            setPersonalId('');
            setBirthYear('');
            await Promise.all([refreshUser(), load()]);
        } catch (e: unknown) {
            const ax = e as { response?: { data?: { error?: string } } };
            setErr(ax.response?.data?.error || 'שגיאה באימות פרטי הזהות');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelRequest = async () => {
        setMsg('');
        setErr('');
        const result = await cancelRegistrationRequest(
            'לבטל את הבקשה הפעילה? תוכל לשלוח בקשה אחרת לאחר מכן.'
        );
        if (result.ok) {
            setMsg('הבקשה בוטלה.');
            await load();
        } else if (result.error) {
            setErr(result.error);
        }
    };

    if (!user) return null;

    const cardClass =
        slug === 'girls'
            ? 'card mb-4 p-4 registration-card registration-card--girls'
            : 'card mb-4 p-4 registration-card';
    const submitBtnClass = slug === 'girls' ? 'btn btn-tournament-primary' : 'btn btn-success';

    if (loading) {
        return (
            <div className={`${cardClass} text-center`}>
                <span
                    className={`spinner-border spinner-border-sm ${slug === 'girls' ? 'text-tournament-primary' : 'text-success'}`}
                    aria-hidden="true"
                />
                <span className="visually-hidden">טוען סטטוס רישום</span>
            </div>
        );
    }

    if (!reg) return null;

    const hasPendingRequest = !!(reg.pendingJoin || reg.pendingCreation || reg.pendingTransfer);
    const showIdentityForm = !!reg.invoiceAlert || reg.status !== 'active';
    const canSubmitIdentity = personalId.trim().length > 0 && birthYear.trim().length > 0;

    return (
        <div className={cardClass} lang="he" aria-live="polite">
            <h3 className="h5 mb-3">{title}</h3>
            <p className="mb-2">
                <span className="text-muted">סטטוס: </span>
                <strong>
                    {reg.awaitingAdminIdentity
                        ? STATUS_LABELS.awaiting_invoice
                        : STATUS_LABELS[reg.status] ?? reg.status}
                </strong>
            </p>

            {reg.awaitingAdminIdentity && (
                <div className="alert alert-info py-2 small mb-3" role="status">
                    הזנת את פרטי הזהות. ממתין שהמנהל ירשום את אותם פרטים — לאחר התאמה תוכל לבקש הצטרפות או הקמת קבוצה.
                    טעית? עדכן למטה לפני שהמנהל רושם, או פנה למנהל.
                </div>
            )}

            {reg.invoiceAlert && (
                <div className="alert alert-warning py-2 small mb-3" role="alert">
                    {reg.invoiceAlert}
                </div>
            )}

            {reg.status === 'active' && !reg.invoiceAlert && (
                <div className="alert alert-success py-2 small mb-3" role="status">
                    פרטי הזהות תואמים לרישום המנהל. הרישום פעיל לעונה.
                </div>
            )}

            {reg.pendingCreation && (
                <p className="small text-warning mb-2">
                    בקשת הקמת קבוצה &quot;{reg.pendingCreation.teamName}&quot; ממתינה לאישור מנהל.
                </p>
            )}
            {reg.pendingJoin && (
                <p className="small text-warning mb-2">
                    בקשת הצטרפות לקבוצה #{reg.pendingJoin.teamId}
                    {reg.pendingJoin.status === 'owner_approved'
                        ? ' — אושרה על ידי הבעלים, ממתין למנהל'
                        : ' — ממתין לאישור בעלים'}
                    .
                </p>
            )}
            {hasPendingRequest && !reg.pendingTransfer && (
                <p className="small text-muted mb-2">
                    ניתן להחזיק בקשה אחת בלבד (הצטרפות או הקמת קבוצה). לשינוי — בטל את הבקשה הנוכחית.
                </p>
            )}
            {hasPendingRequest && (
                <button
                    type="button"
                    className="btn btn-sm btn-outline-danger mb-3"
                    onClick={() => void handleCancelRequest()}
                    disabled={cancelling}
                >
                    {cancelling ? 'מבטל…' : reg.pendingTransfer ? 'בטל בקשת העברה' : 'בטל בקשה'}
                </button>
            )}
            {reg.pendingTransfer && (
                <p className="small text-warning mb-2">
                    בקשת העברה מקבוצה {reg.pendingTransfer.fromTeamId} ל־{reg.pendingTransfer.toTeamId} ממתינה.
                </p>
            )}
            {reg.onRoster && (
                <p className={`small mb-2 ${slug === 'girls' ? 'registration-status-success' : 'text-success'}`}>
                    רשום בסגל (קבוצה #{reg.onRoster.teamId}).
                </p>
            )}

            {reg.status === 'active' &&
                reg.onRoster &&
                !reg.pendingTransfer &&
                !reg.pendingJoin &&
                !reg.pendingCreation && (
                    <TransferRequestForm
                        slug={slug}
                        currentTeamId={reg.onRoster.teamId}
                        onSubmitted={() => void load()}
                    />
                )}

            {reg.status === 'active' && !hasPendingRequest && !reg.onRoster && (
                <p className="small text-muted mb-2">
                    הרישום פעיל. שלח בקשת הצטרפות מעמוד קבוצות או בקשת הקמת קבוצה מהטופס בפרופיל.
                </p>
            )}

            {showIdentityForm && (
                <form onSubmit={handleSubmitIdentity} className="mt-3">
                    <p className="small text-muted mb-2">
                        {reg.invoiceAlert
                            ? 'עדכן את פרטי הזהות ושלח שוב, או פנה למנהל.'
                            : reg.awaitingAdminIdentity
                              ? 'ניתן לעדכן אם טעית. המנהל ירשום את אותם פרטים — הרישום מופעל רק כששני הצדדים תואמים.'
                              : reg.status === 'invoice_assigned'
                                ? 'המנהל רשם את פרטיך. הזן בדיוק את אותם פרטים כדי להפעיל את הרישום. מוגבל ל־3 ניסיונות ביום.'
                                : 'הזן תעודת זהות ושנת לידה. המנהל ירשום את אותם פרטים — הרישום מופעל רק כששני הצדדים תואמים. מוגבל ל־3 ניסיונות ביום.'}
                    </p>
                    <div className="row g-2">
                        <div className="col-sm-7">
                            <label htmlFor={`personal-id-${slug}`} className="form-label">
                                תעודת זהות
                            </label>
                            <input
                                id={`personal-id-${slug}`}
                                type="text"
                                inputMode="numeric"
                                className="form-control"
                                value={personalId}
                                onChange={(e) => setPersonalId(e.target.value.replace(/\D/g, ''))}
                                autoComplete="off"
                                maxLength={9}
                                dir="ltr"
                                aria-describedby={err ? `identity-err-${slug}` : undefined}
                                aria-invalid={!!err}
                            />
                        </div>
                        <div className="col-sm-5">
                            <label htmlFor={`birth-year-${slug}`} className="form-label">
                                שנת לידה
                            </label>
                            <input
                                id={`birth-year-${slug}`}
                                type="number"
                                className="form-control"
                                value={birthYear}
                                onChange={(e) => setBirthYear(e.target.value)}
                                min={1940}
                                max={2015}
                                dir="ltr"
                                aria-invalid={!!err}
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className={`${submitBtnClass} mt-3`}
                        disabled={submitting || !canSubmitIdentity}
                    >
                        {submitting
                            ? 'שולח…'
                            : reg.invoiceAlert || reg.awaitingAdminIdentity
                              ? 'עדכן פרטים'
                              : 'שלח לאימות'}
                    </button>
                </form>
            )}

            {msg && (
                <div className="alert alert-success py-2 small mt-2 mb-0" role="status">
                    {msg}
                </div>
            )}
            {err && (
                <p id={`identity-err-${slug}`} className="text-danger small mt-2 mb-0" role="alert">
                    {err}
                </p>
            )}
        </div>
    );
}
