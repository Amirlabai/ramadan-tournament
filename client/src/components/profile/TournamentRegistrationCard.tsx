import { useEffect, useState } from 'react';
import { usersAPI, type TournamentSlug } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_LABELS: Record<string, string> = {
    none: 'לא התחלת רישום לטורניר',
    join_pending: 'בקשה בתהליך',
    awaiting_invoice: 'ממתין לקוד תשלום',
    invoice_assigned: 'קוד תשלום הוקצה — הזן למטה',
    active: 'רישום פעיל לעונה',
    archived: 'עונה בארכיון',
};

interface RegistrationSummary {
    seasonId: string;
    division: string;
    status: string;
    pendingJoin?: { teamId: number; status: string } | null;
    pendingCreation?: { teamName: string } | null;
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

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await usersAPI.getRegistration(slug);
            setReg(res.data);
        } catch {
            setReg(null);
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
            setMsg('קוד התשלום אושר. כעת ניתן להשלים הצטרפות לקבוצה.');
            await refreshUser();
            await load();
        } catch (e: unknown) {
            const ax = e as { response?: { data?: { error?: string } } };
            setErr(ax.response?.data?.error || 'שגיאה בפדיון הקוד');
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return null;

    if (loading) {
        return (
            <div className="card mb-4 p-4 text-center">
                <span className="spinner-border spinner-border-sm text-success" aria-hidden="true" />
                <span className="visually-hidden">טוען סטטוס רישום</span>
            </div>
        );
    }

    if (!reg) return null;

    const showInvoiceForm = reg.status !== 'active';

    return (
        <div className="card mb-4 p-4" lang="he" aria-live="polite">
            <h3 className="h5 mb-3">{title}</h3>
            <p className="mb-2">
                <span className="text-muted">סטטוס: </span>
                <strong>{STATUS_LABELS[reg.status] ?? reg.status}</strong>
            </p>

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
                </p>
            )}
            {reg.pendingTransfer && (
                <p className="small text-warning mb-2">
                    בקשת העברה מקבוצה {reg.pendingTransfer.fromTeamId} ל־{reg.pendingTransfer.toTeamId} ממתינה.
                </p>
            )}
            {reg.onRoster && (
                <p className="small text-success mb-2">רשום בסגל (קבוצה #{reg.onRoster.teamId}).</p>
            )}

            {showInvoiceForm && (
                <form onSubmit={handleRedeem} className="mt-3">
                    <label htmlFor={`invoice-code-${slug}`} className="form-label">
                        קוד תשלום (מהמנהל לאחר תשלום)
                    </label>
                    <div className="input-group">
                        <input
                            id={`invoice-code-${slug}`}
                            type="text"
                            className="form-control"
                            value={invoiceCode}
                            onChange={(e) => setInvoiceCode(e.target.value.toUpperCase())}
                            autoComplete="off"
                            maxLength={12}
                            dir="ltr"
                            aria-describedby={err ? `invoice-err-${slug}` : undefined}
                            aria-invalid={!!err}
                        />
                        <button type="submit" className="btn btn-success" disabled={submitting || !invoiceCode.trim()}>
                            {submitting ? 'שולח…' : 'אשר קוד'}
                        </button>
                    </div>
                </form>
            )}

            {msg && <p className="text-success small mt-2 mb-0" role="status">{msg}</p>}
            {err && (
                <p id={`invoice-err-${slug}`} className="text-danger small mt-2 mb-0" role="alert">
                    {err}
                </p>
            )}
        </div>
    );
}
