import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../../api/client';
import './RegistrationWorkflowAdmin.css';

interface WorkflowUser {
    id: string;
    displayName: string;
    email: string | null;
}

interface SeasonOption {
    id: string;
    displayName: string;
    division: string;
    isActive: boolean;
}

interface AwaitingInvoiceRow {
    user: WorkflowUser;
    status: string;
    pendingTeamName?: string | null;
    joinStatus?: string | null;
    hasUnredeemedCode?: boolean;
    submittedInvoiceNumber?: string | null;
    assignedInvoiceNumber?: string | null;
}

interface SearchUserRow {
    id: string;
    displayName: string;
    email: string | null;
    registrationStatus: string;
    hasUnredeemedCode: boolean;
    submittedInvoiceNumber?: string | null;
    assignedInvoiceNumber?: string | null;
}

interface WorkflowData {
    season: { id: string; displayName: string; division: string };
    creations: Array<{
        id: string;
        teamName: string;
        registrationStatus: string;
        submittedInvoiceNumber?: string | null;
        assignedInvoiceNumber?: string | null;
        invoicesMatched?: boolean;
        user: WorkflowUser;
    }>;
    joins: Array<{
        id: string;
        status: string;
        registrationStatus: string;
        submittedInvoiceNumber?: string | null;
        assignedInvoiceNumber?: string | null;
        invoicesMatched?: boolean;
        team: { id: number; name: string };
        user: WorkflowUser;
    }>;
    transfers: Array<{
        id: string;
        fromTeamId: number;
        toTeamId: number;
        registrationStatus: string;
        user: WorkflowUser;
    }>;
    awaitingInvoice: AwaitingInvoiceRow[];
}

const canApproveRequest = (registrationStatus: string, invoicesMatched?: boolean) =>
    registrationStatus === 'active' && invoicesMatched === true;

const renderActiveStatus = (status: string) =>
    status === 'active' ? (
        <span className="text-success">פעיל</span>
    ) : (
        <span className="text-muted">לא פעיל</span>
    );

const pendingApprovalHint = (): string => 'ממתין להתאמת חשבונית ורישום פעיל';

export default function RegistrationWorkflowAdmin() {
    const [seasons, setSeasons] = useState<SeasonOption[]>([]);
    const [seasonId, setSeasonId] = useState('');
    const [data, setData] = useState<WorkflowData | null>(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [invoiceInputs, setInvoiceInputs] = useState<Record<string, string>>({});

    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState<SearchUserRow[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        const loadSeasons = async () => {
            try {
                const res = await adminAPI.listSeasons();
                const list: SeasonOption[] = (res.data ?? []).map((s: SeasonOption) => s);
                setSeasons(list);
                const active = list.find((s) => s.isActive && s.division === 'boys') ?? list[0];
                if (active) setSeasonId(active.id);
            } catch {
                setSeasons([]);
            }
        };
        void loadSeasons();
    }, []);

    const load = useCallback(async () => {
        if (!seasonId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setMsg('');
        try {
            const res = await adminAPI.getWorkflowQueues(seasonId);
            setData(res.data);
        } catch (e: unknown) {
            setData(null);
            const ax = e as {
                response?: { data?: { error?: string }; status?: number };
                code?: string;
            };
            if (!ax.response) {
                setMsg('לא ניתן להתחבר לשרת — ודא שהשרת רץ ונסה שוב.');
            } else {
                setMsg(ax.response.data?.error || 'לא ניתן לטעון תורי רישום');
            }
        } finally {
            setLoading(false);
        }
    }, [seasonId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!seasonId || searchQ.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await adminAPI.searchInvoiceUsers(seasonId, searchQ.trim());
                setSearchResults(res.data.users ?? []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQ, seasonId]);

    const assignToUser = async (userId: string, displayName: string, invoiceNumber: string) => {
        if (!data) return;
        const trimmed = invoiceNumber.trim();
        if (!trimmed) {
            setMsg('יש להזין מספר חשבונית');
            return;
        }
        setAssigningId(userId);
        setMsg('');
        try {
            const res = await adminAPI.assignInvoice(userId, data.season.id, trimmed);
            const num = res.data.invoiceNumber as string;
            const similarToUser = res.data.similarToUser as { displayName: string } | undefined;
            const apiMessage = res.data.message as string | undefined;

            let text =
                apiMessage ??
                (res.data.updated
                    ? `מספר החשבונית עודכן ל־${num} (${displayName}).`
                    : `מספר חשבונית ${num} נרשם ל־${displayName}.`);
            if (similarToUser) {
                text += ` שים לב: דומה לחשבונית של ${similarToUser.displayName}.`;
            }
            setMsg(text);
            setInvoiceInputs((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
            await load();
        } catch (e: unknown) {
            const ax = e as {
                response?: { data?: { error?: string } };
                code?: string;
                message?: string;
            };
            if (!ax.response) {
                setMsg('לא ניתן להתחבר לשרת — ייתכן שהוא מתעדכן. המתן רגע ונסה שוב.');
            } else {
                setMsg(ax.response.data?.error || 'שגיאה בהקצאת חשבונית');
            }
        } finally {
            setAssigningId(null);
        }
    };

    const renderUserSubmittedCell = (submittedInvoiceNumber?: string | null) => {
        const value = submittedInvoiceNumber?.trim();
        return (
            <span dir="ltr" className={`workflow-monospace ${value ? 'font-monospace' : 'text-muted'}`}>
                {value ?? '—'}
            </span>
        );
    };

    const renderAssignCell = (row: {
        user: WorkflowUser;
        hasUnredeemedCode?: boolean;
        registrationStatus?: string;
        status?: string;
        assignedInvoiceNumber?: string | null;
        submittedInvoiceNumber?: string | null;
    }) => {
        const { user } = row;
        const regStatus = row.registrationStatus ?? row.status;

        const isCorrection =
            row.hasUnredeemedCode ||
            regStatus === 'invoice_assigned' ||
            (regStatus === 'awaiting_invoice' && !!row.assignedInvoiceNumber);
        const value = invoiceInputs[user.id] ?? row.assignedInvoiceNumber ?? '';

        return (
            <div className="workflow-assign-row">
                <input
                    type="text"
                    className="form-control form-control-sm workflow-invoice-input"
                    placeholder={isCorrection ? 'מספר מתוקן' : 'מספר חשבונית'}
                    value={value}
                    onChange={(e) =>
                        setInvoiceInputs((prev) => ({
                            ...prev,
                            [user.id]: e.target.value.toUpperCase(),
                        }))
                    }
                    dir="ltr"
                    aria-label={`מספר חשבונית עבור ${user.displayName}`}
                    maxLength={24}
                    disabled={assigningId === user.id}
                />
                <button
                    type="button"
                    className={`btn btn-sm text-nowrap workflow-assign-btn ${
                        isCorrection ? 'btn-warning' : 'btn-success'
                    }`}
                    disabled={assigningId === user.id || !value.trim()}
                    onClick={() => void assignToUser(user.id, user.displayName, value)}
                >
                    {assigningId === user.id ? 'שומר…' : isCorrection ? 'עדכן' : 'הקצה'}
                </button>
            </div>
        );
    };

    const renderInvoiceUserCard = (row: {
        user: WorkflowUser;
        status?: string;
        registrationStatus?: string;
        pendingTeamName?: string | null;
        hasUnredeemedCode?: boolean;
        submittedInvoiceNumber?: string | null;
        assignedInvoiceNumber?: string | null;
    }) => {
        const status = row.registrationStatus ?? row.status ?? 'none';

        return (
            <article className="workflow-user-card" aria-label={row.user.displayName}>
                <div className="workflow-user-card__header">
                    <div className="workflow-user-card__identity">
                        <div className="fw-semibold">{row.user.displayName}</div>
                        {row.user.email && (
                            <div dir="ltr" className="text-muted small workflow-user-card__email">
                                {row.user.email}
                            </div>
                        )}
                    </div>
                    <div className="workflow-user-card__status">{renderActiveStatus(status)}</div>
                </div>
                <dl className="workflow-user-card__details">
                    {row.pendingTeamName && (
                        <div className="workflow-user-card__row">
                            <dt>קבוצה</dt>
                            <dd>{row.pendingTeamName}</dd>
                        </div>
                    )}
                    <div className="workflow-user-card__row">
                        <dt>הזנת משתמש</dt>
                        <dd>{renderUserSubmittedCell(row.submittedInvoiceNumber)}</dd>
                    </div>
                    <div className="workflow-user-card__row">
                        <dt>מספר חשבונית (מנהל)</dt>
                        <dd>{renderAssignCell(row)}</dd>
                    </div>
                </dl>
            </article>
        );
    };

    if (!seasons.length && !loading) {
        return <p className="text-muted">אין עונות במערכת</p>;
    }

    return (
        <div className="registration-workflow-admin" lang="he">
            <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
                <div>
                    <label htmlFor="workflow-season" className="form-label mb-1">
                        עונה
                    </label>
                    <select
                        id="workflow-season"
                        className="form-select"
                        value={seasonId}
                        onChange={(e) => setSeasonId(e.target.value)}
                    >
                        {seasons.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.displayName} ({s.division === 'girls' ? 'בנות' : 'בנים'})
                                {s.isActive ? ' — פעילה' : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void load()}>
                    רענן
                </button>
            </div>

            {loading && <p className="text-muted">טוען תורים…</p>}
            {!loading && !data && (
                <p className="text-danger" role="alert">
                    {msg || (seasons.length === 0 ? 'אין עונות במערכת — הרץ seed או בחר עונה.' : 'לא ניתן לטעון תורי רישום')}
                </p>
            )}

            {!loading && data && (
                <>
                    <h4 className="mb-3">רישום ותשלום — {data.season.displayName}</h4>

                    {msg && (
                        <p className="alert alert-info py-2 small" role="status">
                            {msg}
                        </p>
                    )}

                    <section className="mb-4 p-3 border rounded">
                        <h5 className="h6 mb-2">הקצאת חשבונית ({data.awaitingInvoice.length})</h5>
                        <p className="text-muted small mb-3">
                            הזן את מספר החשבונית מהתשלום בפועל ולחץ הקצה.
                            המשתמש יכול להזין בפרופיל לפני או אחרי — הרישום מופעל רק כשהמספרים תואמים.
                            משתמשים שהותאמו כבר לא מופיעים כאן.
                        </p>
                        <div className="workflow-user-card-list" role="list" aria-label="משתמשים הממתינים להקצאת קוד תשלום">
                            {data.awaitingInvoice.map((r) => (
                                <div key={r.user.id} role="listitem">
                                    {renderInvoiceUserCard(r)}
                                </div>
                            ))}
                        </div>
                        {!data.awaitingInvoice.length && (
                            <p className="text-muted small mb-0 mt-2">אין משתמשים ברשימה — חפש למטה לפי אימייל.</p>
                        )}
                    </section>

                    <section className="mb-4 p-3 border rounded">
                        <h5 className="h6 mb-2">חיפוש משתמש (אימייל או שם)</h5>
                        <input
                            type="search"
                            className="form-control mb-2"
                            placeholder="לפחות 2 תווים — למשל חלק מהאימייל"
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            aria-label="חיפוש משתמש להקצאת קוד"
                        />
                        {searching && <p className="text-muted small">מחפש…</p>}
                        {searchQ.trim().length >= 2 && !searching && (
                            <div className="workflow-user-card-list" role="list" aria-label="תוצאות חיפוש משתמשים">
                                {searchResults.map((u) => (
                                    <div key={u.id} role="listitem">
                                        {renderInvoiceUserCard({
                                            user: {
                                                id: u.id,
                                                displayName: u.displayName,
                                                email: u.email,
                                            },
                                            registrationStatus: u.registrationStatus,
                                            hasUnredeemedCode: u.hasUnredeemedCode,
                                            submittedInvoiceNumber: u.submittedInvoiceNumber,
                                            assignedInvoiceNumber: u.assignedInvoiceNumber,
                                        })}
                                    </div>
                                ))}
                                {!searchResults.length && (
                                    <p className="text-muted small mt-2 mb-0">לא נמצאו משתמשים</p>
                                )}
                            </div>
                        )}
                    </section>

                    <section className="mb-3">
                        <h5 className="h6">הקמת קבוצות ({data.creations.length})</h5>
                        <div className="table-responsive">
                            <table className="table table-sm table-hover align-middle mb-0">
                                <caption className="visually-hidden">בקשות הקמת קבוצות ממתינות</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">קבוצה / משתמש</th>
                                        <th scope="col">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.creations.map((c) => {
                                        const paid = canApproveRequest(
                                            c.registrationStatus,
                                            c.invoicesMatched
                                        );
                                        return (
                                            <tr
                                                key={c.id}
                                                className={paid ? '' : 'opacity-50'}
                                                aria-disabled={!paid}
                                            >
                                                <td>
                                                    <span className="fw-semibold">{c.teamName}</span>
                                                    <span className="d-block small">
                                                        {c.user.displayName}
                                                        {c.user.email && (
                                                            <span className="text-muted" dir="ltr">
                                                                {' '}
                                                                ({c.user.email})
                                                            </span>
                                                        )}
                                                    </span>
                                                    {!paid && (
                                                        <span className="d-block small text-muted mt-1">
                                                            {pendingApprovalHint()}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-success me-1"
                                                        disabled={!paid}
                                                        title={
                                                            paid
                                                                ? undefined
                                                                : 'לא ניתן לאשר לפני התאמת חשבונית ורישום פעיל'
                                                        }
                                                        onClick={async () => {
                                                            setMsg('');
                                                            try {
                                                                await adminAPI.reviewCreationRequest(c.id, true);
                                                                await load();
                                                            } catch (e: unknown) {
                                                                const ax = e as {
                                                                    response?: { data?: { error?: string } };
                                                                };
                                                                setMsg(
                                                                    ax.response?.data?.error ||
                                                                        'לא ניתן לאשר את הבקשה'
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        אשר
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        title={paid ? undefined : 'דחייה זמינה גם לפני חשבונית'}
                                                        onClick={async () => {
                                                            await adminAPI.reviewCreationRequest(c.id, false);
                                                            load();
                                                        }}
                                                    >
                                                        דחה
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {!data.creations.length && (
                            <p className="text-muted small mb-0">אין</p>
                        )}
                    </section>

                    <section className="mb-3">
                        <h5 className="h6">
                            הצטרפות (אחרי בעלים) (
                            {data.joins.filter((j) => j.status === 'owner_approved').length})
                        </h5>
                        <div className="table-responsive">
                            <table className="table table-sm table-hover align-middle mb-0">
                                <caption className="visually-hidden">
                                    בקשות הצטרפות לאחר אישור בעלים
                                </caption>
                                <thead>
                                    <tr>
                                        <th scope="col">משתמש / קבוצה</th>
                                        <th scope="col">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.joins
                                        .filter((j) => j.status === 'owner_approved')
                                        .map((j) => {
                                            const paid = canApproveRequest(
                                                j.registrationStatus,
                                                j.invoicesMatched
                                            );
                                            return (
                                                <tr
                                                    key={j.id}
                                                    className={paid ? '' : 'opacity-50'}
                                                    aria-disabled={!paid}
                                                >
                                                    <td>
                                                        <span className="fw-semibold">{j.user.displayName}</span>
                                                        {j.user.email && (
                                                            <span className="text-muted small" dir="ltr">
                                                                {' '}
                                                                ({j.user.email})
                                                            </span>
                                                        )}
                                                        <span className="d-block small">→ {j.team.name}</span>
                                                        {!paid && (
                                                            <span className="d-block small text-muted mt-1">
                                                                {pendingApprovalHint()}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-success me-1"
                                                            disabled={!paid}
                                                            title={
                                                                paid
                                                                    ? undefined
                                                                    : 'לא ניתן לאשר לפני התאמת חשבונית ורישום פעיל'
                                                            }
                                                            onClick={async () => {
                                                                setMsg('');
                                                                try {
                                                                    await adminAPI.reviewJoinRequest(j.id, true);
                                                                    await load();
                                                                } catch (e: unknown) {
                                                                    const ax = e as {
                                                                        response?: { data?: { error?: string } };
                                                                    };
                                                                    setMsg(
                                                                        ax.response?.data?.error ||
                                                                            'לא ניתן לאשר את הבקשה'
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            אשר סגל
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            title={paid ? undefined : 'דחייה זמינה גם לפני חשבונית'}
                                                            onClick={async () => {
                                                                await adminAPI.reviewJoinRequest(j.id, false);
                                                                load();
                                                            }}
                                                        >
                                                            דחה
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                        {!data.joins.filter((j) => j.status === 'owner_approved').length && (
                            <p className="text-muted small mb-0">אין</p>
                        )}
                    </section>

                    <section className="mb-3">
                        <h5 className="h6">העברות ({data.transfers.length})</h5>
                        <ul className="list-group list-group-flush">
                            {data.transfers.map((t) => (
                                <li
                                    key={t.id}
                                    className="list-group-item d-flex justify-content-between"
                                >
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
                            {!data.transfers.length && (
                                <li className="list-group-item text-muted">אין</li>
                            )}
                        </ul>
                    </section>
                </>
            )}
        </div>
    );
}
