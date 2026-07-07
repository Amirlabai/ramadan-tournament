import { useCallback, useEffect, useState } from 'react';
import { getRegistrationStatusLabel } from '@ramadan-tournament/shared';
import { adminAPI } from '../../api/client';
import { mergedIdentityQueue } from '../../utils/adminWorkflowPendingCount';
import { useNavActionIndicators } from '../../contexts/NavActionIndicatorsContext';
import { isBirthYearInRange, sanitizeBirthYearInput } from '../../utils/birthYearInput';
import { isValidIsraeliId, sanitizePersonalIdInput } from '../../utils/israeliIdValidation';
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

interface AwaitingIdentityRow {
    user: WorkflowUser;
    status: string;
    pendingTeamName?: string | null;
    joinStatus?: string | null;
    hasAdminAssignment?: boolean;
    submittedIdentityMasked?: string | null;
    submittedBirthYear?: number | null;
    assignedBirthYear?: number | null;
}

interface SearchUserRow {
    id: string;
    displayName: string;
    email: string | null;
    registrationStatus: string;
    hasAdminAssignment: boolean;
    submittedIdentityMasked?: string | null;
    submittedBirthYear?: number | null;
    assignedBirthYear?: number | null;
}

interface WorkflowData {
    season: { id: string; displayName: string; division: string };
    creations: Array<{
        id: string;
        teamName: string;
        registrationStatus: string;
        submittedIdentityMasked?: string | null;
        submittedBirthYear?: number | null;
        assignedBirthYear?: number | null;
        identityMatched?: boolean;
        user: WorkflowUser;
    }>;
    joins: Array<{
        id: string;
        status: string;
        registrationStatus: string;
        submittedIdentityMasked?: string | null;
        submittedBirthYear?: number | null;
        assignedBirthYear?: number | null;
        identityMatched?: boolean;
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
    awaitingIdentity: AwaitingIdentityRow[];
}

const canApproveRequest = (registrationStatus: string, identityMatched?: boolean) =>
    registrationStatus === 'active' && identityMatched === true;

const renderRegistrationStatus = (status: string) => {
    const label = getRegistrationStatusLabel(status);
    if (status === 'active') {
        return <span className="text-success">{label}</span>;
    }
    return <span className="text-muted">{label}</span>;
};

const pendingApprovalHint = (): string => 'ממתין להתאמת זהות ורישום פעיל';

type IdentityInput = { personalId: string; birthYear: string };

export default function RegistrationWorkflowAdmin() {
    const { refreshIndicators, refreshAdminCount } = useNavActionIndicators();
    const [seasons, setSeasons] = useState<SeasonOption[]>([]);
    const [seasonId, setSeasonId] = useState('');
    const [data, setData] = useState<WorkflowData | null>(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [identityInputs, setIdentityInputs] = useState<Record<string, IdentityInput>>({});

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

    const load = useCallback(async (opts?: { refreshNav?: boolean }) => {
        if (!seasonId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setMsg('');
        try {
            const res = await adminAPI.getWorkflowQueues(seasonId);
            const raw = res.data as WorkflowData & { awaitingInvoice?: AwaitingIdentityRow[] };
            setData({
                ...raw,
                awaitingIdentity: mergedIdentityQueue(raw) as AwaitingIdentityRow[],
            });
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
            if (opts?.refreshNav) {
                await refreshIndicators({ light: true });
                await refreshAdminCount();
            }
        }
    }, [seasonId, refreshIndicators, refreshAdminCount]);

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
                const res = await adminAPI.searchIdentityUsers(seasonId, searchQ.trim());
                setSearchResults(res.data.users ?? []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQ, seasonId]);

    const assignToUser = async (
        userId: string,
        displayName: string,
        personalId: string,
        birthYear: string
    ) => {
        if (!data) return;
        const pid = personalId.trim();
        const by = birthYear.trim();
        if (!pid || !by) {
            setMsg('יש להזין תעודת זהות ושנת לידה');
            return;
        }
        if (!isValidIsraeliId(pid) || !isBirthYearInRange(by)) {
            setMsg('תעודת זהות או שנת לידה לא תקינים');
            return;
        }
        setAssigningId(userId);
        setMsg('');
        try {
            const res = await adminAPI.assignIdentity(userId, data.season.id, pid, by);
            const apiMessage = res.data.message as string | undefined;
            setMsg(apiMessage ?? `פרטי הזהות נרשמו ל־${displayName}.`);
            setIdentityInputs((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
            await load({ refreshNav: true });
        } catch (e: unknown) {
            const ax = e as {
                response?: { data?: { error?: string } };
                code?: string;
                message?: string;
            };
            if (!ax.response) {
                setMsg('לא ניתן להתחבר לשרת — ייתכן שהוא מתעדכן. המתן רגע ונסה שוב.');
            } else {
                setMsg(ax.response.data?.error || 'שגיאה ברישום זהות');
            }
        } finally {
            setAssigningId(null);
        }
    };

    const renderUserSubmittedCell = (
        submittedIdentityMasked?: string | null,
        submittedBirthYear?: number | null
    ) => {
        const masked = submittedIdentityMasked?.trim();
        if (!masked && submittedBirthYear == null) {
            return <span className="text-muted">—</span>;
        }
        return (
            <span dir="ltr" className="workflow-monospace font-monospace">
                {masked ?? '—'}
                {submittedBirthYear != null && (
                    <span className="text-muted"> · {submittedBirthYear}</span>
                )}
            </span>
        );
    };

    const renderAssignCell = (row: {
        user: WorkflowUser;
        hasAdminAssignment?: boolean;
        registrationStatus?: string;
        status?: string;
        assignedBirthYear?: number | null;
    }) => {
        const { user } = row;
        const regStatus = row.registrationStatus ?? row.status;

        const isCorrection =
            row.hasAdminAssignment ||
            regStatus === 'identity_assigned' ||
            (regStatus === 'awaiting_identity' && row.assignedBirthYear != null);
        const stored = identityInputs[user.id];
        const personalId = stored?.personalId ?? '';
        const birthYear = stored?.birthYear ?? (row.assignedBirthYear != null ? String(row.assignedBirthYear) : '');
        const canAssign = isValidIsraeliId(personalId) && isBirthYearInRange(birthYear);
        const idFieldInvalid = personalId.length > 0 && !isValidIsraeliId(personalId);
        const yearFieldInvalid = birthYear.length > 0 && !isBirthYearInRange(birthYear);

        return (
            <div className="workflow-assign-row">
                <input
                    type="text"
                    className={`form-control form-control-sm workflow-identity-input workflow-identity-input--pid${idFieldInvalid ? ' identity-field--invalid' : personalId.length === 0 ? ' identity-field--pending' : ''}`}
                    placeholder={isCorrection ? 'ת.ז. מתוקנת' : 'תעודת זהות'}
                    value={personalId}
                    onChange={(e) =>
                        setIdentityInputs((prev) => ({
                            ...prev,
                            [user.id]: {
                                personalId: sanitizePersonalIdInput(e.target.value),
                                birthYear: prev[user.id]?.birthYear ?? birthYear,
                            },
                        }))
                    }
                    dir="ltr"
                    inputMode="numeric"
                    aria-label={`תעודת זהות עבור ${user.displayName}`}
                    maxLength={9}
                    disabled={assigningId === user.id}
                    aria-invalid={idFieldInvalid}
                />
                <input
                    type="text"
                    inputMode="numeric"
                    className={`form-control form-control-sm workflow-identity-input workflow-identity-input--year${yearFieldInvalid ? ' identity-field--invalid' : birthYear.length === 0 ? ' identity-field--pending' : ''}`}
                    placeholder="שנת לידה"
                    value={birthYear}
                    onChange={(e) =>
                        setIdentityInputs((prev) => ({
                            ...prev,
                            [user.id]: {
                                personalId: prev[user.id]?.personalId ?? personalId,
                                birthYear: sanitizeBirthYearInput(e.target.value),
                            },
                        }))
                    }
                    dir="ltr"
                    maxLength={4}
                    aria-label={`שנת לידה עבור ${user.displayName}`}
                    disabled={assigningId === user.id}
                    aria-invalid={yearFieldInvalid}
                />
                <button
                    type="button"
                    className={`btn btn-sm text-nowrap workflow-assign-btn btn-gated ${
                        isCorrection ? 'btn-warning' : 'btn-success'
                    }`}
                    disabled={assigningId === user.id || !canAssign}
                    aria-describedby={
                        !canAssign && assigningId !== user.id ? `workflow-assign-hint-${user.id}` : undefined
                    }
                    title={!canAssign && assigningId !== user.id ? 'הזן ת.ז. (9 ספרות) ושנת לידה תקינה' : undefined}
                    onClick={() => void assignToUser(user.id, user.displayName, personalId, birthYear)}
                >
                    {assigningId === user.id ? 'שומר…' : isCorrection ? 'עדכן' : 'הקצה'}
                </button>
                {!canAssign && assigningId !== user.id && (
                    <p id={`workflow-assign-hint-${user.id}`} className="visually-hidden">
                        הזן ת.ז. (9 ספרות) ושנת לידה תקינה
                    </p>
                )}
            </div>
        );
    };

    const renderIdentityUserCard = (row: {
        user: WorkflowUser;
        status?: string;
        registrationStatus?: string;
        pendingTeamName?: string | null;
        hasAdminAssignment?: boolean;
        submittedIdentityMasked?: string | null;
        submittedBirthYear?: number | null;
        assignedBirthYear?: number | null;
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
                    <div className="workflow-user-card__status">{renderRegistrationStatus(status)}</div>
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
                        <dd>
                            {renderUserSubmittedCell(
                                row.submittedIdentityMasked,
                                row.submittedBirthYear
                            )}
                        </dd>
                    </div>
                    <div className="workflow-user-card__row">
                        <dt>אימות מנהל (ת"ז + שנת לידה של שחקן).</dt>
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
            <div className="d-flex flex-wrap align-items-end gap-3 mb-3 workflow-toolbar">
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
                <button type="button" className="btn btn-secondary workflow-refresh-btn" onClick={() => void load()}>
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
                        <h5 className="h6 mb-2">רישום זהות ({data.awaitingIdentity.length})</h5>
                        <p className="text-muted small mb-3">
                            הזן תעודת זהות ושנת לידה מהרישום בפועל ולחץ הקצה.
                            המשתמש יכול להזין בפרופיל לפני או אחרי — הרישום מופעל רק כשהפרטים תואמים.
                            משתמשים שהותאמו כבר לא מופיעים כאן.
                        </p>
                        <div className="workflow-user-card-list" role="list" aria-label="משתמשים הממתינים לרישום זהות">
                            {data.awaitingIdentity.map((r) => (
                                <div key={r.user.id} role="listitem">
                                    {renderIdentityUserCard(r)}
                                </div>
                            ))}
                        </div>
                        {!data.awaitingIdentity.length && (
                            <p className="text-muted small mb-0 mt-2">אין משתמשים ברשימה — חפש למטה לפי אימייל.</p>
                        )}
                    </section>

                    <section className="mb-4 p-3 border rounded">
                        <label htmlFor="workflow-user-search" className="form-label">חיפוש משתמש (אימייל או שם)</label>
                        <input
                            id="workflow-user-search"
                            type="search"
                            className="form-control mb-2"
                            placeholder="לפחות 2 תווים — למשל חלק מהאימייל"
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                        />
                        {searching && <p className="text-muted small">מחפש…</p>}
                        {searchQ.trim().length >= 2 && !searching && (
                            <div className="workflow-user-card-list" role="list" aria-label="תוצאות חיפוש משתמשים">
                                {searchResults.map((u) => (
                                    <div key={u.id} role="listitem">
                                        {renderIdentityUserCard({
                                            user: {
                                                id: u.id,
                                                displayName: u.displayName,
                                                email: u.email,
                                            },
                                            registrationStatus: u.registrationStatus,
                                            hasAdminAssignment: u.hasAdminAssignment,
                                            submittedIdentityMasked: u.submittedIdentityMasked,
                                            submittedBirthYear: u.submittedBirthYear,
                                            assignedBirthYear: u.assignedBirthYear,
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
                                            c.identityMatched
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
                                                                : 'לא ניתן לאשר לפני התאמת זהות ורישום פעיל'
                                                        }
                                                        onClick={async () => {
                                                            setMsg('');
                                                            try {
                                                                await adminAPI.reviewCreationRequest(c.id, true);
                                                                await load({ refreshNav: true });
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
                                                        title={paid ? undefined : 'דחייה זמינה גם לפני אימות זהות'}
                                                        onClick={async () => {
                                                            setMsg('');
                                                            try {
                                                                await adminAPI.reviewCreationRequest(c.id, false);
                                                                await load({ refreshNav: true });
                                                            } catch (e: unknown) {
                                                                const ax = e as {
                                                                    response?: { data?: { error?: string } };
                                                                };
                                                                setMsg(
                                                                    ax.response?.data?.error ||
                                                                        'לא ניתן לדחות את הבקשה'
                                                                );
                                                            }
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
                                                j.identityMatched
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
                                                                    : 'לא ניתן לאשר לפני התאמת זהות ורישום פעיל'
                                                            }
                                                            onClick={async () => {
                                                                setMsg('');
                                                                try {
                                                                    await adminAPI.reviewJoinRequest(j.id, true);
                                                                    await load({ refreshNav: true });
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
                                                            title={paid ? undefined : 'דחייה זמינה גם לפני אימות זהות'}
                                                            onClick={async () => {
                                                                setMsg('');
                                                                try {
                                                                    await adminAPI.reviewJoinRequest(j.id, false);
                                                                    await load({ refreshNav: true });
                                                                } catch (e: unknown) {
                                                                    const ax = e as {
                                                                        response?: { data?: { error?: string } };
                                                                    };
                                                                    setMsg(
                                                                        ax.response?.data?.error ||
                                                                            'לא ניתן לדחות את הבקשה'
                                                                    );
                                                                }
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
                                                setMsg('');
                                                try {
                                                    await adminAPI.reviewTransferRequest(t.id, true);
                                                    await load({ refreshNav: true });
                                                } catch (e: unknown) {
                                                    const ax = e as { response?: { data?: { error?: string } } };
                                                    setMsg(ax.response?.data?.error || 'לא ניתן לאשר את ההעברה');
                                                }
                                            }}
                                        >
                                            אשר
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={async () => {
                                                setMsg('');
                                                try {
                                                    await adminAPI.reviewTransferRequest(t.id, false);
                                                    await load({ refreshNav: true });
                                                } catch (e: unknown) {
                                                    const ax = e as { response?: { data?: { error?: string } } };
                                                    setMsg(ax.response?.data?.error || 'לא ניתן לדחות את ההעברה');
                                                }
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
