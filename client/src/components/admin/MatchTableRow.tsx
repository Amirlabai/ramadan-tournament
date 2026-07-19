import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getMatchDisplayStatus } from '@ramadan-tournament/shared';
import type { Match, Team, Goal } from '../../types';
import { matchStatsAPI } from '../../api/client';
import AddGoalWizardModal, { type AddGoalSubmit } from './AddGoalWizardModal';
import TechnicalWinModal from './TechnicalWinModal';
import { applyGoalsAndScores } from '../../utils/matchGoals';

interface MatchTableRowProps {
    match: Match;
    index?: number;
    teams: Team[];
    onSave: (id: number, data: any) => Promise<void>;
    onDelete: (id: number) => void;
    onAddGoal?: (matchId: number, payload: AddGoalSubmit) => Promise<void>;
    onTechnicalWin?: (matchId: number, winnerTeamId: number | null) => Promise<void>;
    startInEditMode?: boolean;
}

// ── helpers (same logic as MatchForm) ──────────────────────────────────────────

const toJerusalemIsoString = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
    const p = (t: string) => parts.find(x => x.type === t)?.value;
    return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`;
};

const jerusalemStringToISO = (s: string): string => {
    if (!s) return '';
    const [datePart, timePart] = s.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const targetTime = Date.UTC(year, month - 1, day, hour, minute);
    let estimated = new Date(targetTime);
    for (let i = 0; i < 3; i++) {
        const jStr = toJerusalemIsoString(estimated);
        const [jDate, jTime] = jStr.split('T');
        const [jY, jM, jD] = jDate.split('-').map(Number);
        const [jH, jMin] = jTime.split(':').map(Number);
        const actualInJerusalem = Date.UTC(jY, jM - 1, jD, jH, jMin);
        const diff = actualInJerusalem - targetTime;
        if (diff === 0) break;
        estimated = new Date(estimated.getTime() - diff);
    }
    return estimated.toISOString();
};

// ─────────────────────────────────────────────────────────────────────────────

const MatchTableRow = ({
    match,
    index,
    teams,
    onSave,
    onDelete,
    onAddGoal,
    onTechnicalWin,
    startInEditMode = false,
}: MatchTableRowProps) => {
    const [isEditing, setIsEditing] = useState(startInEditMode);
    const [showAddGoalWizard, setShowAddGoalWizard] = useState(false);
    const [showTechnicalWin, setShowTechnicalWin] = useState(false);
    const [saving, setSaving] = useState(false);
    const [regenLoading, setRegenLoading] = useState(false);
    const [regenMessage, setRegenMessage] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuUp, setMenuUp] = useState(false);
    const [menuMaxHeight, setMenuMaxHeight] = useState<number | undefined>(undefined);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuBtnRef = useRef<HTMLButtonElement>(null);
    const menuListRef = useRef<HTMLUListElement>(null);
    const [draft, setDraft] = useState({
        team1Id: match.team1Id.toString(),
        team2Id: match.team2Id.toString(),
        score1: match.score1?.toString() ?? '',
        score2: match.score2?.toString() ?? '',
        date: toJerusalemIsoString(new Date(match.date)),
        location: match.location,
        phase: match.phase,
        goals: (match.goals ?? []) as Goal[],
    });

    // Re-seed draft if match prop changes externally (e.g. after another save)
    useEffect(() => {
        setDraft({
            team1Id: match.team1Id.toString(),
            team2Id: match.team2Id.toString(),
            score1: match.score1?.toString() ?? '',
            score2: match.score2?.toString() ?? '',
            date: toJerusalemIsoString(new Date(match.date)),
            location: match.location,
            phase: match.phase,
            goals: (match.goals ?? []) as Goal[],
        });
    }, [match]);

    useEffect(() => {
        if (!menuOpen) return;
        const onDoc = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [menuOpen]);

    useLayoutEffect(() => {
        if (!menuOpen) {
            setMenuUp(false);
            setMenuMaxHeight(undefined);
            return;
        }

        const placeMenu = () => {
            const wrap = menuRef.current;
            const menu = menuListRef.current;
            const btn = menuBtnRef.current;
            if (!wrap || !menu || !btn) return;

            // Measure natural height without a prior cap.
            menu.style.maxHeight = '';
            const menuHeight = menu.scrollHeight;
            const pad = 8;

            const tableWrap = wrap.closest('.matches-table-wrapper');
            const clipRect = tableWrap?.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();
            const bottomEdge = Math.min(window.innerHeight, clipRect?.bottom ?? window.innerHeight);
            const topEdge = Math.max(0, clipRect?.top ?? 0);

            const spaceBelow = bottomEdge - btnRect.bottom - pad;
            const spaceAbove = btnRect.top - topEdge - pad;

            let up = false;
            if (spaceBelow >= menuHeight) {
                up = false;
            } else if (spaceAbove >= menuHeight) {
                up = true;
            } else {
                // Neither fits — pick the larger side and scroll inside the menu.
                up = spaceAbove > spaceBelow;
            }

            const available = Math.max(0, up ? spaceAbove : spaceBelow);
            setMenuUp(up);
            setMenuMaxHeight(available < menuHeight ? Math.max(available, 88) : undefined);
        };

        placeMenu();

        const tableWrap = menuRef.current?.closest('.matches-table-wrapper');
        const closeOnScroll = (e: Event) => {
            // Keep open while scrolling inside a height-capped menu.
            if (menuListRef.current?.contains(e.target as Node)) return;
            setMenuOpen(false);
        };
        const onResize = () => placeMenu();

        tableWrap?.addEventListener('scroll', closeOnScroll, { passive: true });
        window.addEventListener('resize', onResize);
        // Capture ancestor scrolls (page / admin panel) that would leave the menu stranded.
        window.addEventListener('scroll', closeOnScroll, true);

        return () => {
            tableWrap?.removeEventListener('scroll', closeOnScroll);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', closeOnScroll, true);
        };
    }, [menuOpen]);

    const getTeamName = (id: number) => teams.find(t => t.id === id)?.name ?? `קבוצה ${id}`;

    const handleRegenerateStats = async () => {
        if (match.id === -1) return;
        setRegenLoading(true);
        setRegenMessage('');
        try {
            await matchStatsAPI.regenerate(match.id);
            setRegenMessage('סטטיסטיקה חודשה');
        } catch {
            setRegenMessage('חידוש נכשל');
        } finally {
            setRegenLoading(false);
        }
    };

    useEffect(() => {
        if (!regenMessage) return;
        const t = window.setTimeout(() => setRegenMessage(''), 4000);
        return () => window.clearTimeout(t);
    }, [regenMessage]);

    const handleCancel = () => {
        // Reset draft to current match
        setDraft({
            team1Id: match.team1Id.toString(),
            team2Id: match.team2Id.toString(),
            score1: match.score1?.toString() ?? '',
            score2: match.score2?.toString() ?? '',
            date: toJerusalemIsoString(new Date(match.date)),
            location: match.location,
            phase: match.phase,
            goals: (match.goals ?? []) as Goal[],
        });
        setIsEditing(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const team1Id = parseInt(draft.team1Id);
            const team2Id = parseInt(draft.team2Id);
            const synced = applyGoalsAndScores(draft, draft.goals, teams);
            const hasGoals = synced.goals.length > 0;
            let technicalWinnerTeamId = hasGoals ? null : (match.technicalWinnerTeamId ?? null);
            if (
                technicalWinnerTeamId != null
                && technicalWinnerTeamId !== team1Id
                && technicalWinnerTeamId !== team2Id
            ) {
                technicalWinnerTeamId = null;
            }
            const payload = {
                team1Id,
                team2Id,
                score1: parseInt(synced.score1),
                score2: parseInt(synced.score2),
                date: jerusalemStringToISO(draft.date),
                location: draft.location,
                phase: draft.phase,
                goals: synced.goals,
                technicalWinnerTeamId,
            };
            await onSave(match.id, payload);
            setIsEditing(false);
        } catch (_) { /* parent already shows alert */ }
        finally { setSaving(false); }
    };

    const set = (key: string, val: any) => setDraft(d => ({ ...d, [key]: val }));

    const setTeam = (key: 'team1Id' | 'team2Id', val: string) => {
        setDraft(d => {
            const next = { ...d, [key]: val };
            return applyGoalsAndScores(next, next.goals, teams);
        });
    };

    const addGoal = (memberId: number) => {
        setDraft(d => applyGoalsAndScores(d, [...d.goals, { memberId, minute: 0 }], teams));
    };
    const removeGoal = (idx: number) => {
        setDraft(d => applyGoalsAndScores(d, d.goals.filter((_, i) => i !== idx), teams));
    };

    // Players of the two selected teams
    const team1Players = teams.find(t => t.id === parseInt(draft.team1Id))?.players ?? [];
    const team2Players = teams.find(t => t.id === parseInt(draft.team2Id))?.players ?? [];
    const allPlayers = [...team1Players, ...team2Players];

    const playerLabel = (memberId: number | null | undefined) => {
        if (memberId == null) return 'גול עצמי';
        const p = allPlayers.find(x => x.memberId === memberId);
        return p ? (p.nickname || `${p.firstName} ${p.lastName}`) : `#${memberId}`;
    };

    const goalLabel = (g: Goal) => {
        if (g.isOwnGoal) return 'גול עצמי';
        return playerLabel(g.memberId);
    };

    const formatDate = (iso: string) =>
        new Intl.DateTimeFormat('he-IL', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
        }).format(new Date(iso));

    const phaseLabel = (p: string) => p === 'group' ? 'שלב הבתים' : 'נוקאאוט';

    const rowClass = index !== undefined && index % 2 === 0 ? 'row-even' : 'row-odd';

    // ── Read-only row ──────────────────────────────────────────────────────────
    if (!isEditing) {
        const goalSummary = match.technicalWinnerTeamId != null
            ? `ניצחון טכני: ${getTeamName(match.technicalWinnerTeamId)}`
            : (match.goals ?? []).length > 0
                ? (match.goals ?? []).map(g => goalLabel(g)).join(', ')
                : '—';

        return (
            <>
                <tr className={`match-table-row ${rowClass}`}>
                    <td data-label="תאריך ושעה" className="text-nowrap">{formatDate(match.date)}</td>
                    <td data-label="מיקום">{match.location}</td>
                    <td data-label="שלב">
                        <div className="d-flex flex-column gap-1">
                            <span className={`badge phase-badge phase-${match.phase}`}>{phaseLabel(match.phase)}</span>
                            {match.phase === 'knockout' && (
                                <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>פלייאוף</span>
                            )}
                        </div>
                    </td>
                    <td data-label="קבוצה 1" className="team-cell">{getTeamName(match.team1Id)}</td>
                    <td data-label="תוצאה" className="score-cell text-center">
                        <span className="score-display">
                            {match.score1 ?? '—'} : {match.score2 ?? '—'}
                        </span>
                        {match.technicalWinnerTeamId != null && (
                            <span className="badge bg-secondary d-block mt-1" style={{ fontSize: '0.65rem' }}>טכני</span>
                        )}
                    </td>
                    <td data-label="קבוצה 2" className="team-cell">{getTeamName(match.team2Id)}</td>
                    <td data-label="כובשים" className="goals-cell">{goalSummary}</td>
                    <td data-label="פעולות" className="actions-cell text-nowrap">
                        <div className="match-row-actions">
                            {onAddGoal && match.id !== -1 && match.technicalWinnerTeamId == null && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-theme-green match-action-add-goal"
                                    onClick={() => setShowAddGoalWizard(true)}
                                >
                                    הוסף שער
                                </button>
                            )}
                            <div className="match-row-more" ref={menuRef}>
                                    <button
                                        ref={menuBtnRef}
                                        type="button"
                                        className={`btn btn-sm match-row-more-btn${regenMessage ? (regenMessage.includes('נכשל') ? ' match-row-more-btn--error' : ' match-row-more-btn--ok') : ''}`}
                                        aria-expanded={menuOpen}
                                        aria-haspopup="menu"
                                        aria-label="עוד פעולות"
                                        title={regenMessage || 'עוד פעולות'}
                                        onClick={() => setMenuOpen((open) => !open)}
                                    >
                                        {regenMessage && !regenMessage.includes('נכשל') ? (
                                            '✓'
                                        ) : (
                                            <>
                                                <span className="match-row-more-btn-icon" aria-hidden="true">⋮</span>
                                                <span className="match-row-more-btn-label">עוד פעולות</span>
                                            </>
                                        )}
                                    </button>
                                    {regenMessage ? (
                                        <span
                                            className={`match-row-regen-toast${regenMessage.includes('נכשל') ? ' match-row-regen-toast--error' : ''}`}
                                            role="status"
                                        >
                                            {regenMessage}
                                        </span>
                                    ) : null}
                                    {menuOpen && (
                                        <ul
                                            ref={menuListRef}
                                            className={`match-row-more-menu${menuUp ? ' match-row-more-menu--up' : ''}`}
                                            style={menuMaxHeight != null ? { maxHeight: menuMaxHeight } : undefined}
                                            role="menu"
                                        >
                                            {match.id !== -1
                                                && match.technicalWinnerTeamId == null
                                                && getMatchDisplayStatus(match.date, new Date(), match.technicalWinnerTeamId) !== 'upcoming' && (
                                                <li role="none">
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="match-row-more-item"
                                                        disabled={regenLoading}
                                                        onClick={() => {
                                                            setMenuOpen(false);
                                                            void handleRegenerateStats();
                                                        }}
                                                    >
                                                        {regenLoading ? 'מחדש…' : 'חדש סטטיסטיקה'}
                                                    </button>
                                                </li>
                                            )}
                                            {match.id !== -1 && onTechnicalWin && match.technicalWinnerTeamId == null
                                                && (match.goals ?? []).length === 0 && (
                                                <li role="none">
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="match-row-more-item"
                                                        onClick={() => {
                                                            setMenuOpen(false);
                                                            setShowTechnicalWin(true);
                                                        }}
                                                    >
                                                        ניצחון טכני
                                                    </button>
                                                </li>
                                            )}
                                            {match.id !== -1 && onTechnicalWin && match.technicalWinnerTeamId != null && (
                                                <li role="none">
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="match-row-more-item match-row-more-item--danger"
                                                        onClick={() => {
                                                            setMenuOpen(false);
                                                            void (async () => {
                                                                if (!window.confirm('לבטל את הניצחון הטכני? המשחק יחזור למצב ללא תוצאה.')) {
                                                                    return;
                                                                }
                                                                try {
                                                                    await onTechnicalWin(match.id, null);
                                                                } catch (err: unknown) {
                                                                    alert(err instanceof Error ? err.message : 'שגיאה בביטול ניצחון טכני');
                                                                }
                                                            })();
                                                        }}
                                                    >
                                                        בטל ניצחון טכני
                                                    </button>
                                                </li>
                                            )}
                                            <li role="none">
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    className="match-row-more-item"
                                                    onClick={() => {
                                                        setMenuOpen(false);
                                                        setIsEditing(true);
                                                    }}
                                                >
                                                    ערוך
                                                </button>
                                            </li>
                                            <li role="none">
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    className="match-row-more-item match-row-more-item--danger"
                                                    onClick={() => {
                                                        setMenuOpen(false);
                                                        onDelete(match.id);
                                                    }}
                                                >
                                                    {match.id === -1 ? 'בטל' : 'מחק'}
                                                </button>
                                            </li>
                                        </ul>
                                    )}
                                </div>
                        </div>
                    </td>
                </tr>
                {showAddGoalWizard && onAddGoal && (
                    <AddGoalWizardModal
                        match={match}
                        teams={teams}
                        onClose={() => setShowAddGoalWizard(false)}
                        onSubmit={async (payload) => {
                            await onAddGoal(match.id, payload);
                        }}
                    />
                )}
                {showTechnicalWin && onTechnicalWin && (
                    <TechnicalWinModal
                        match={match}
                        teams={teams}
                        onClose={() => setShowTechnicalWin(false)}
                        onSubmit={async (winnerTeamId) => {
                            await onTechnicalWin(match.id, winnerTeamId);
                        }}
                    />
                )}
            </>
        );
    }

    // ── Editing row ───────────────────────────────────────────────────────────
    return (
        <>
            <tr className={`match-table-row editing-row ${rowClass}`}>
                {/* Date */}
                <td data-label="תאריך ושעה">
                    <input
                        type="datetime-local"
                        className="form-control form-control-sm"
                        value={draft.date}
                        onChange={e => set('date', e.target.value)}
                    />
                </td>
                {/* Location */}
                <td data-label="מיקום">
                    <input
                        type="text"
                        className="form-control form-control-sm"
                        value={draft.location}
                        onChange={e => set('location', e.target.value)}
                    />
                </td>
                {/* Phase */}
                <td data-label="שלב">
                    <select className="form-select form-select-sm" value={draft.phase} onChange={e => set('phase', e.target.value)}>
                        <option value="group">שלב הבתים</option>
                        <option value="knockout">נוקאאוט</option>
                    </select>
                </td>
                {/* Team 1 */}
                <td data-label="קבוצה 1" className="team-cell">
                    <select
                        className="form-select form-select-sm"
                        value={draft.team1Id}
                        onChange={e => setTeam('team1Id', e.target.value)}
                        disabled={match.technicalWinnerTeamId != null}
                        title={match.technicalWinnerTeamId != null ? 'בטל ניצחון טכני לפני שינוי קבוצות' : undefined}
                    >
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </td>
                {/* Score — derived from scorers */}
                <td data-label="תוצאה" className="score-cell">
                    <div className="d-flex align-items-center gap-1 justify-content-center">
                        <span className="score-display" title="מחושב מכובשים">
                            {draft.score1 || '0'} : {draft.score2 || '0'}
                        </span>
                    </div>
                </td>
                {/* Team 2 */}
                <td data-label="קבוצה 2" className="team-cell">
                    <select
                        className="form-select form-select-sm"
                        value={draft.team2Id}
                        onChange={e => setTeam('team2Id', e.target.value)}
                        disabled={match.technicalWinnerTeamId != null}
                        title={match.technicalWinnerTeamId != null ? 'בטל ניצחון טכני לפני שינוי קבוצות' : undefined}
                    >
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </td>
                {/* Goals placeholder — managed in expanded row below */}
                <td data-label="כובשים" className="goals-cell text-muted fst-italic" style={{ fontSize: '0.8rem' }}>ראה למטה</td>
                {/* Actions */}
                <td data-label="פעולות" className="actions-cell text-nowrap">
                    <button className="btn btn-sm btn-success ms-1" onClick={handleSave} disabled={saving}>
                        {saving ? <span className="spinner-border spinner-border-sm" /> : 'שמור'}
                    </button>
                    <button className="btn btn-sm btn-secondary ms-1" onClick={handleCancel} disabled={saving}>בטל</button>
                </td>
            </tr>

            {/* Goals management — expanded row */}
            <tr className={`goals-edit-row ${rowClass}`}>
                <td colSpan={8} className="p-2">
                    <div className="goals-editor">
                        <span className="goals-editor-label">כובשים:</span>

                        {/* Current goals */}
                        <div className="goals-list">
                            {draft.goals.length === 0 && (
                                <span className="text-muted fst-italic" style={{ fontSize: '0.8rem' }}>אין כובשים</span>
                            )}
                            {draft.goals.map((g, idx) => (
                                <span key={idx} className="goal-tag">
                                    {goalLabel(g)}
                                    <button type="button" className="goal-remove" onClick={() => removeGoal(idx)}>×</button>
                                </span>
                            ))}
                        </div>

                        {/* Add scorer */}
                        <select
                            className="form-select form-select-sm add-goal-select"
                            value=""
                            onChange={e => { if (e.target.value) { addGoal(parseInt(e.target.value)); e.target.value = ''; } }}
                        >
                            <option value="">+ הוסף מבקיע</option>
                            {team1Players.length > 0 && (
                                <optgroup label={getTeamName(parseInt(draft.team1Id))}>
                                    {team1Players.map(p => (
                                        <option key={p.memberId} value={p.memberId}>
                                            {`${p.nickname} (${p.firstName} ${p.lastName})`}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {team2Players.length > 0 && (
                                <optgroup label={getTeamName(parseInt(draft.team2Id))}>
                                    {team2Players.map(p => (
                                        <option key={p.memberId} value={p.memberId}>
                                            {`${p.nickname} (${p.firstName} ${p.lastName})`}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>
                </td>
            </tr>
        </>
    );
};

export default MatchTableRow;
