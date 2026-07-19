import { useCallback, useEffect, useRef, useState } from 'react';
import { registrationAPI, type TournamentSlug } from '../../api/client';
import type { Player } from '../../types';

const ROLE_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'ספסל' },
    { value: 'captain', label: 'קפטן' },
    { value: 'goalkeeper', label: 'שוער' },
    { value: 'attack', label: 'התקפה' },
    { value: 'defense', label: 'הגנה' },
];

interface Props {
    teamId: number;
    players: Player[];
    slug: TournamentSlug;
    onSaved?: () => void;
}

export default function OwnerSquadRoles({ teamId, players, slug, onSaved }: Props) {
    const [roles, setRoles] = useState<Record<number, string>>({});
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [saving, setSaving] = useState(false);
    const dirtyRef = useRef(false);

    useEffect(() => {
        dirtyRef.current = false;
    }, [teamId]);

    useEffect(() => {
        if (saving || dirtyRef.current) return;
        const initial: Record<number, string> = {};
        for (const p of players) {
            initial[p.memberId] = p.squadRole ?? '';
        }
        setRoles(initial);
    }, [players, saving]);

    const handleChange = (memberId: number, value: string) => {
        dirtyRef.current = true;
        setRoles((prev) => ({ ...prev, [memberId]: value }));
        setMsg('');
        setErr('');
    };

    const handleSave = useCallback(async () => {
        setSaving(true);
        setMsg('');
        setErr('');
        try {
            const payload = players.map((p) => ({
                memberId: p.memberId,
                squadRole: roles[p.memberId] ? roles[p.memberId] : null,
            }));
            await registrationAPI.setSquadRoles(teamId, payload, slug);
            setMsg('תפקידי הסגל עודכנו');
            dirtyRef.current = false;
            onSaved?.();
        } catch (e: unknown) {
            const ax = e as { response?: { data?: { error?: string } } };
            setErr(ax.response?.data?.error || 'שגיאה בשמירת תפקידים');
        } finally {
            setSaving(false);
        }
    }, [teamId, players, roles, slug, onSaved]);

    if (players.length === 0) return null;

    return (
        <div className="border rounded p-3 bg-white mb-3" role="region" aria-label="ניהול הרכב פתיחה">
            <h3 className="h6 fw-bold mb-2">הרכב פתיחה / ספסל</h3>
            <p className="small text-muted mb-3">
                {slug === 'boys'
                    ? 'עד 5 שחקני שדה ושוער אחד בהרכב פתיחה.'
                    : 'הגדר תפקידים לשחקני הקבוצה.'}
            </p>
            <ul className="list-unstyled mb-3">
                {players.map((p) => (
                    <li
                        key={p.memberId}
                        className="d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 border-bottom"
                    >
                        <span>
                            {p.firstName} {p.lastName}
                            {p.nickname ? ` (${p.nickname})` : ''}
                            <span className="text-muted small ms-1">#{p.number}</span>
                        </span>
                        <label className="visually-hidden" htmlFor={`squad-role-${teamId}-${p.memberId}`}>
                            תפקיד: {p.firstName} {p.lastName}
                        </label>
                        <select
                            id={`squad-role-${teamId}-${p.memberId}`}
                            className="form-select form-select-sm"
                            style={{ maxWidth: 140 }}
                            value={roles[p.memberId] ?? ''}
                            onChange={(e) => handleChange(p.memberId, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value || 'bench'} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </li>
                ))}
            </ul>
            {err && (
                <p className="small text-danger mb-2" role="alert">
                    {err}
                </p>
            )}
            {msg && (
                <p className="small text-success mb-2" role="status">
                    {msg}
                </p>
            )}
            <button
                type="button"
                className="btn btn-sm btn-success"
                disabled={saving}
                onClick={(e) => {
                    e.stopPropagation();
                    void handleSave();
                }}
            >
                {saving ? 'שומר…' : 'שמור תפקידים'}
            </button>
        </div>
    );
}
