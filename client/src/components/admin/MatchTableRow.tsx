import { useState, useEffect } from 'react';
import type { Match, Team, Goal } from '../../types';

interface MatchTableRowProps {
    match: Match;
    index?: number;
    teams: Team[];
    onSave: (id: number, data: any) => Promise<void>;
    onDelete: (id: number) => void;
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

const MatchTableRow = ({ match, index, teams, onSave, onDelete, startInEditMode = false }: MatchTableRowProps) => {
    const [isEditing, setIsEditing] = useState(startInEditMode);
    const [saving, setSaving] = useState(false);
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

    const getTeamName = (id: number) => teams.find(t => t.id === id)?.name ?? `קבוצה ${id}`;

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
            const payload = {
                ...draft,
                team1Id: parseInt(draft.team1Id),
                team2Id: parseInt(draft.team2Id),
                score1: draft.score1 === '' ? undefined : parseInt(draft.score1),
                score2: draft.score2 === '' ? undefined : parseInt(draft.score2),
                date: jerusalemStringToISO(draft.date),
            };
            await onSave(match.id, payload);
            setIsEditing(false);
        } catch (_) { /* parent already shows alert */ }
        finally { setSaving(false); }
    };

    const set = (key: string, val: any) => setDraft(d => ({ ...d, [key]: val }));

    const addGoal = (memberId: number) => {
        setDraft(d => ({ ...d, goals: [...d.goals, { memberId, minute: 0 }] }));
    };
    const removeGoal = (idx: number) => {
        setDraft(d => ({ ...d, goals: d.goals.filter((_, i) => i !== idx) }));
    };

    // Players of the two selected teams
    const team1Players = teams.find(t => t.id === parseInt(draft.team1Id))?.players ?? [];
    const team2Players = teams.find(t => t.id === parseInt(draft.team2Id))?.players ?? [];
    const allPlayers = [...team1Players, ...team2Players];

    const playerLabel = (memberId: number) => {
        const p = allPlayers.find(x => x.memberId === memberId);
        return p ? (p.nickname || `${p.firstName} ${p.lastName}`) : `#${memberId}`;
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
        const goalSummary = (match.goals ?? []).length > 0
            ? (match.goals ?? []).map(g => playerLabel(g.memberId)).join(', ')
            : '—';

        return (
            <tr className={`match-table-row ${rowClass}`}>
                <td data-label="תאריך ושעה" className="text-nowrap">{formatDate(match.date)}</td>
                <td data-label="מיקום">{match.location}</td>
                <td data-label="שלב"><span className={`badge phase-badge phase-${match.phase}`}>{phaseLabel(match.phase)}</span></td>
                <td data-label="קבוצה 1" className="team-cell">{getTeamName(match.team1Id)}</td>
                <td data-label="תוצאה" className="score-cell text-center">
                    <span className="score-display">
                        {match.score1 ?? '—'} : {match.score2 ?? '—'}
                    </span>
                </td>
                <td data-label="קבוצה 2" className="team-cell">{getTeamName(match.team2Id)}</td>
                <td data-label="כובשים" className="goals-cell">{goalSummary}</td>
                <td data-label="פעולות" className="actions-cell text-nowrap">
                    <button className="btn btn-sm btn-warning ms-1" onClick={() => setIsEditing(true)}>ערוך</button>
                    <button className="btn btn-sm btn-danger ms-1" onClick={() => onDelete(match.id)}>מחק</button>
                </td>
            </tr>
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
                    <select className="form-select form-select-sm" value={draft.team1Id} onChange={e => set('team1Id', e.target.value)}>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </td>
                {/* Score */}
                <td data-label="תוצאה" className="score-cell">
                    <div className="d-flex align-items-center gap-1 justify-content-center">
                        <input type="number" min="0" className="form-control form-control-sm score-input text-center"
                            value={draft.score1} onChange={e => set('score1', e.target.value)} />
                        <span>:</span>
                        <input type="number" min="0" className="form-control form-control-sm score-input text-center"
                            value={draft.score2} onChange={e => set('score2', e.target.value)} />
                    </div>
                </td>
                {/* Team 2 */}
                <td data-label="קבוצה 2" className="team-cell">
                    <select className="form-select form-select-sm" value={draft.team2Id} onChange={e => set('team2Id', e.target.value)}>
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
                                    {playerLabel(g.memberId)}
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
