import { useEffect, useState } from 'react';
import { usersAPI, type TournamentSlug } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useCancelRegistrationRequest } from '../../hooks/useCancelRegistrationRequest';
import './TournamentRegistrationCard.css';

const STATUS_LABELS: Record<string, string> = {
    none: 'שלב 1: ממתין שהמנהל ירשום את מספר החשבונית',
    join_pending: 'בקשה בתהליך',
    awaiting_invoice: 'ממתין למספר חשבונית מהמנהל',
    invoice_assigned: 'המנהל רשם חשבונית — הזן את אותו מספר בדיוק להפעלה',
    active: 'רישום פעיל — ניתן לשלוח בקשת הצטרפות או הקמת קבוצה',
    archived: 'עונה בארכיון',
};

interface RegistrationSummary {
    seasonId: string;
    division: string;
    status: string;
    invoiceAlert?: string | null;
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
    const [invoiceCode, setInvoiceCode] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { cancelRegistrationRequest, cancelling } = useCancelRegistrationRequest(slug);

    const load = async (): Promise<RegistrationSummary | null> => {
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
    };

    useEffect(() => {
        load();
    }, [user, slug]);

    const handleRedeem = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setMsg('');
        setErr('');
        try {
            await usersAPI.redeemInvoice(invoiceCode.trim(), slug);
            setInvoiceCode('');
            await Promise.all([refreshUser(), load()]);
        } catch (e: unknown) {
            const ax = e as { response?: { data?: { error?: string } } };
            setErr(ax.response?.data?.error || 'שגיאה באימות מספר החשבונית');
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
    const showInvoiceForm = reg.status !== 'active' || !!reg.invoiceAlert;

    return (
        <div className={cardClass} lang="he" aria-live="polite">
            <h3 className="h5 mb-3">{title}</h3>
            <p className="mb-2">
                <span className="text-muted">סטטוס: </span>
                <strong>{STATUS_LABELS[reg.status] ?? reg.status}</strong>
            </p>

            {reg.invoiceAlert && (
                <div className="alert alert-warning py-2 small mb-3" role="alert">
                    {reg.invoiceAlert}
                </div>
            )}

            {reg.status === 'active' && !reg.invoiceAlert && (
                <div className="alert alert-success py-2 small mb-3" role="status">
                    מספר החשבונית תואם לרישום המנהל. הרישום פעיל לעונה.
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

            {reg.status === 'active' && !hasPendingRequest && !reg.onRoster && (
                <p className="small text-muted mb-2">
                    הרישום פעיל. שלח בקשת הצטרפות מעמוד קבוצות או בקשת הקמת קבוצה מהטופס בפרופיל.
                </p>
            )}

            {showInvoiceForm && (
                <form onSubmit={handleRedeem} className="mt-3">
                    <p className="small text-muted mb-2">
                        {reg.invoiceAlert
                            ? 'עדכן את מספר החשבונית ושלח שוב, או פנה למנהל.'
                            : reg.status === 'invoice_assigned'
                              ? 'שלב 2: המנהל רשם את מספר החשבונית. הזן בדיוק את אותו מספר כדי להפעיל את הרישום. רק לאחר התאמה ניתן לשלוח בקשת הצטרפות או הקמת קבוצה. מוגבל ל־3 ניסיונות ביום.'
                              : 'שלב 1: המנהל ירשום את מספר החשבונית לאחר התשלום. לאחר מכן הזן כאן בדיוק את אותו מספר. מוגבל ל־3 ניסיונות ביום.'}
                    </p>
                    <label htmlFor={`invoice-code-${slug}`} className="form-label">
                        מספר חשבונית (לאחר תשלום)
                    </label>
                    <div className="input-group">
                        <input
                            id={`invoice-code-${slug}`}
                            type="text"
                            className="form-control"
                            value={invoiceCode}
                            onChange={(e) => setInvoiceCode(e.target.value.toUpperCase())}
                            autoComplete="off"
                            maxLength={24}
                            dir="ltr"
                            aria-describedby={err ? `invoice-err-${slug}` : undefined}
                            aria-invalid={!!err}
                        />
                        <button type="submit" className={submitBtnClass} disabled={submitting || !invoiceCode.trim()}>
                            {submitting ? 'שולח…' : reg.invoiceAlert ? 'שלח שוב' : 'שלח חשבונית'}
                        </button>
                    </div>
                </form>
            )}

            {msg && (
                <div className="alert alert-success py-2 small mt-2 mb-0" role="status">
                    {msg}
                </div>
            )}
            {err && (
                <p id={`invoice-err-${slug}`} className="text-danger small mt-2 mb-0" role="alert">
                    {err}
                </p>
            )}
        </div>
    );
}
