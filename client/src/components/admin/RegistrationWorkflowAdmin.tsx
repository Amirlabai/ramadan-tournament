import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../../api/client';

interface WorkflowUser {
    id: string;
    displayName: string;
    email: string | null;
}

interface WorkflowData {
    season: { id: string; displayName: string; division: string };
    creations: Array<{ id: string; teamName: string; user: WorkflowUser }>;
    joins: Array<{
        id: string;
        status: string;
        team: { id: number; name: string };
        user: WorkflowUser;
    }>;
    transfers: Array<{
        id: string;
        fromTeamId: number;
        toTeamId: number;
        user: WorkflowUser;
    }>;
    awaitingInvoice: Array<{ user: WorkflowUser; status: string }>;
}

export default function RegistrationWorkflowAdmin() {
    const [data, setData] = useState<WorkflowData | null>(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [assignUserId, setAssignUserId] = useState('');
    const [assignedCode, setAssignedCode] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminAPI.getWorkflowQueues();
            setData(res.data);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleAssign = async () => {
        if (!data || !assignUserId.trim()) return;
        setMsg('');
        try {
            const res = await adminAPI.assignInvoice(assignUserId.trim(), data.season.id);
            setAssignedCode(res.data.code);
            setAssignUserId('');
            setMsg('קוד הוקצה. העבר למשתמש — לא יוצג שוב.');
            await load();
        } catch (e: unknown) {
            const ax = e as { response?: { data?: { error?: string } } };
            setMsg(ax.response?.data?.error || 'שגיאה');
        }
    };

    if (loading) {
        return <p className="text-muted">טוען תורים…</p>;
    }
    if (!data) {
        return <p className="text-danger">לא ניתן לטעון תורי רישום</p>;
    }

    return (
        <div className="registration-workflow-admin" lang="he">
            <h4 className="mb-3">רישום ותשלום — {data.season.displayName}</h4>

            <section className="mb-4 p-3 border rounded">
                <h5 className="h6">הקצאת קוד תשלום</h5>
                <div className="input-group mb-2">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="מזהה משתמש (UUID)"
                        value={assignUserId}
                        onChange={(e) => setAssignUserId(e.target.value)}
                        aria-label="מזהה משתמש להקצאת קוד"
                        dir="ltr"
                    />
                    <button type="button" className="btn btn-success" onClick={handleAssign}>
                        הקצה קוד
                    </button>
                </div>
                {assignedCode && (
                    <p className="alert alert-warning mb-0" role="status">
                        קוד חד-פעמי: <strong dir="ltr">{assignedCode}</strong>
                    </p>
                )}
            </section>

            {msg && <p className="small text-info" role="status">{msg}</p>}

            <section className="mb-3">
                <h5 className="h6">ממתינים לקוד ({data.awaitingInvoice.length})</h5>
                <ul className="list-group list-group-flush">
                    {data.awaitingInvoice.map((r) => (
                        <li key={r.user.id} className="list-group-item d-flex justify-content-between">
                            <span>{r.user.displayName} — {r.user.email}</span>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() => setAssignUserId(r.user.id)}
                            >
                                הקצה
                            </button>
                        </li>
                    ))}
                    {!data.awaitingInvoice.length && <li className="list-group-item text-muted">אין</li>}
                </ul>
            </section>

            <section className="mb-3">
                <h5 className="h6">הקמת קבוצות ({data.creations.length})</h5>
                <ul className="list-group list-group-flush">
                    {data.creations.map((c) => (
                        <li key={c.id} className="list-group-item d-flex justify-content-between align-items-center">
                            <span>{c.teamName} — {c.user.displayName}</span>
                            <span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-success me-1"
                                    onClick={async () => {
                                        await adminAPI.reviewCreationRequest(c.id, true);
                                        load();
                                    }}
                                >
                                    אשר
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={async () => {
                                        await adminAPI.reviewCreationRequest(c.id, false);
                                        load();
                                    }}
                                >
                                    דחה
                                </button>
                            </span>
                        </li>
                    ))}
                    {!data.creations.length && <li className="list-group-item text-muted">אין</li>}
                </ul>
            </section>

            <section className="mb-3">
                <h5 className="h6">הצטרפות (אחרי בעלים) ({data.joins.filter((j) => j.status === 'owner_approved').length})</h5>
                <ul className="list-group list-group-flush">
                    {data.joins
                        .filter((j) => j.status === 'owner_approved')
                        .map((j) => (
                            <li key={j.id} className="list-group-item d-flex justify-content-between">
                                <span>
                                    {j.user.displayName} → {j.team.name}
                                </span>
                                <span>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-success me-1"
                                        onClick={async () => {
                                            await adminAPI.reviewJoinRequest(j.id, true);
                                            load();
                                        }}
                                    >
                                        אשר סגל
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={async () => {
                                            await adminAPI.reviewJoinRequest(j.id, false);
                                            load();
                                        }}
                                    >
                                        דחה
                                    </button>
                                </span>
                            </li>
                        ))}
                    {!data.joins.filter((j) => j.status === 'owner_approved').length && (
                        <li className="list-group-item text-muted">אין</li>
                    )}
                </ul>
            </section>

            <section className="mb-3">
                <h5 className="h6">העברות ({data.transfers.length})</h5>
                <ul className="list-group list-group-flush">
                    {data.transfers.map((t) => (
                        <li key={t.id} className="list-group-item d-flex justify-content-between">
                            <span>
                                {t.user.displayName}: {t.fromTeamId} → {t.toTeamId}
                            </span>
                            <span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-success me-1"
                                    onClick={async () => {
                                        await adminAPI.reviewTransferRequest(t.id, true);
                                        load();
                                    }}
                                >
                                    אשר
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={async () => {
                                        await adminAPI.reviewTransferRequest(t.id, false);
                                        load();
                                    }}
                                >
                                    דחה
                                </button>
                            </span>
                        </li>
                    ))}
                    {!data.transfers.length && <li className="list-group-item text-muted">אין</li>}
                </ul>
            </section>
        </div>
    );
}
