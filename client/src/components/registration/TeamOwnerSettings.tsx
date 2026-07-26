import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TEAM_DESC_MAX_LEN, TEAM_NAME_MAX_LEN } from '@ramadan-tournament/shared';
import { teamsAPI, type TournamentSlug } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { isPlatformAdmin } from '../../utils/tournamentUser';
import BannerCropModal from './BannerCropModal';

type LogoPosition = 'left' | 'right' | 'none';
type ManagerKind = 'admin' | 'owner' | 'captain';

const MANAGER_ROLE_LABEL: Record<ManagerKind, string> = {
    admin: 'מנהל מערכת',
    owner: 'בעלים',
    captain: 'קפטן',
};

interface TeamMeta {
    name: string;
    description: string;
    logoUrl?: string;
    customLogoUrl?: string;
    logoPosition: LogoPosition;
    bannerUrl?: string;
}

export interface TeamOwnerSnapshot {
    name: string;
    description?: string;
    logoUrl?: string;
    customLogoUrl?: string;
    logoPosition?: LogoPosition;
    bannerUrl?: string;
}

interface Props {
    teamId: number;
    slug: TournamentSlug;
    variant?: 'card' | 'inline';
    /** Optional list snapshot — seeds state on mount only; not re-synced while collapsed or editing. */
    initialTeam?: TeamOwnerSnapshot;
    onUpdated?: (snapshot?: TeamOwnerSnapshot) => void;
    onEditingChange?: (editing: boolean) => void;
}

type StatusMsg = { type: 'success' | 'error'; text: string };

const REFRESH_FAILED_MSG = 'העדכון נשמר, אך לא ניתן לרענן את התצוגה. רענן את העמוד';

function snapshotToMeta(snapshot: TeamOwnerSnapshot): TeamMeta {
    return {
        name: snapshot.name,
        description: snapshot.description || '',
        logoUrl: snapshot.logoUrl,
        customLogoUrl: snapshot.customLogoUrl,
        logoPosition: snapshot.logoPosition || 'right',
        bannerUrl: snapshot.bannerUrl,
    };
}

export default function TeamOwnerSettings({
    teamId,
    slug,
    variant = 'card',
    initialTeam,
    onUpdated,
    onEditingChange,
}: Props) {
    const { user } = useAuth();
    const managerKind = useMemo((): ManagerKind => {
        if (isPlatformAdmin(user)) return 'admin';
        if (slug === 'boys' || slug === 'girls') {
            const reg = user?.tournamentRegistration?.[slug];
            if (reg?.ownedTeamId === teamId) return 'owner';
            if (reg?.onRoster?.isCaptain === true && reg.onRoster.teamId === teamId) return 'captain';
        }
        return 'owner';
    }, [user, slug, teamId]);
    const managerLabel = MANAGER_ROLE_LABEL[managerKind];

    const [team, setTeam] = useState<TeamMeta | null>(() =>
        initialTeam ? snapshotToMeta(initialTeam) : null
    );
    const [loading, setLoading] = useState(!initialTeam);
    const [loadError, setLoadError] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [logoLoading, setLogoLoading] = useState(false);
    const [bannerLoading, setBannerLoading] = useState(false);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [status, setStatus] = useState<StatusMsg | null>(null);
    const [form, setForm] = useState({ name: '', description: '', logoPosition: 'right' as LogoPosition });

    const editingRef = useRef(editing);
    editingRef.current = editing;

    const closeCrop = useCallback(() => {
        setCropSrc((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
    }, []);

    useEffect(() => {
        return () => {
            if (cropSrc) URL.revokeObjectURL(cropSrc);
        };
    }, [cropSrc]);

    useEffect(() => {
        onEditingChange?.(editing);
    }, [editing, onEditingChange]);

    useEffect(() => {
        return () => {
            onEditingChange?.(false);
        };
    }, [onEditingChange]);

    const applyMeta = useCallback((meta: TeamMeta) => {
        setTeam(meta);
        setForm({
            name: meta.name,
            description: meta.description,
            logoPosition: meta.logoPosition,
        });
    }, []);

    const refreshTeam = useCallback(async (): Promise<TeamOwnerSnapshot | null> => {
        try {
            const res = await teamsAPI.getById(teamId, slug);
            const snapshot = res.data as TeamOwnerSnapshot;
            applyMeta(snapshotToMeta(snapshot));
            setLoadError('');
            return snapshot;
        } catch {
            return null;
        }
    }, [teamId, slug, applyMeta]);

    const loadTeam = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        const snapshot = await refreshTeam();
        if (!snapshot) {
            setLoadError('שגיאה בטעינת פרטי הקבוצה');
        }
        setLoading(false);
    }, [refreshTeam]);

    // Sync only when the target team changes — not when `initialTeam` object identity churns.
    // `initialTeam` is omitted from deps on purpose: parent list refetch updates branding only
    // via onUpdated → refreshTeam after save/upload/delete; avoids resetting the edit form.
    useEffect(() => {
        if (editingRef.current) return;

        setEditing(false);
        setStatus(null);
        setLoadError('');

        if (initialTeam) {
            applyMeta(snapshotToMeta(initialTeam));
            setLoading(false);
            return;
        }

        void loadTeam();
        // initialTeam intentionally omitted — parent inline literals must not re-sync the form
    }, [teamId, slug, applyMeta, loadTeam]);

    const logoSrc = resolveAssetUrl(team?.logoUrl);
    const bannerSrc = resolveAssetUrl(team?.bannerUrl);
    const hasCustomLogo = Boolean(team?.customLogoUrl?.trim());

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setStatus(null);
        try {
            await teamsAPI.updateMetadata(teamId, form, slug);
            const snapshot = await refreshTeam();
            setEditing(false);
            if (snapshot) {
                setStatus({ type: 'success', text: 'פרטי הקבוצה עודכנו בהצלחה' });
                onUpdated?.(snapshot);
            } else {
                setStatus({ type: 'error', text: REFRESH_FAILED_MSG });
            }
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setStatus({
                type: 'error',
                text: ax.response?.data?.error || 'שגיאה בעדכון הפרטים',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoLoading(true);
        setStatus(null);
        try {
            const formData = new FormData();
            formData.append('logo', file);
            await teamsAPI.uploadLogo(teamId, formData, slug);
            const snapshot = await refreshTeam();
            if (snapshot) {
                setStatus({ type: 'success', text: 'הלוגו הועלה בהצלחה' });
                onUpdated?.(snapshot);
            } else {
                setStatus({ type: 'error', text: REFRESH_FAILED_MSG });
            }
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setStatus({
                type: 'error',
                text: ax.response?.data?.error || 'שגיאה בהעלאת הלוגו',
            });
        } finally {
            setLogoLoading(false);
            e.target.value = '';
        }
    };

    const handleDeleteLogo = async () => {
        if (!confirm('האם למחוק את לוגו הקבוצה?')) return;
        setLogoLoading(true);
        setStatus(null);
        try {
            await teamsAPI.deleteLogo(teamId, slug);
            const snapshot = await refreshTeam();
            if (snapshot) {
                setStatus({ type: 'success', text: 'הלוגו נמחק בהצלחה' });
                onUpdated?.(snapshot);
            } else {
                setStatus({ type: 'error', text: REFRESH_FAILED_MSG });
            }
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setStatus({
                type: 'error',
                text: ax.response?.data?.error || 'שגיאה במחיקת הלוגו',
            });
        } finally {
            setLogoLoading(false);
        }
    };

    const handleBannerFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setStatus(null);
        const url = URL.createObjectURL(file);
        setCropSrc((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
        });
    };

    const handleBannerCropConfirm = async (blob: Blob) => {
        setBannerLoading(true);
        setStatus(null);
        try {
            const formData = new FormData();
            formData.append('banner', blob, `team_${teamId}_banner.jpg`);
            await teamsAPI.uploadBanner(teamId, formData, slug);
            const snapshot = await refreshTeam();
            closeCrop();
            if (snapshot) {
                setStatus({ type: 'success', text: 'הבאנר הועלה בהצלחה' });
                onUpdated?.(snapshot);
            } else {
                setStatus({ type: 'error', text: REFRESH_FAILED_MSG });
            }
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setStatus({
                type: 'error',
                text: ax.response?.data?.error || 'שגיאה בהעלאת הבאנר',
            });
            throw err;
        } finally {
            setBannerLoading(false);
        }
    };

    const handleDeleteBanner = async () => {
        if (!confirm('האם למחוק את באנר הקבוצה?')) return;
        setBannerLoading(true);
        setStatus(null);
        try {
            await teamsAPI.deleteBanner(teamId, slug);
            const snapshot = await refreshTeam();
            if (snapshot) {
                setStatus({ type: 'success', text: 'הבאנר נמחק בהצלחה' });
                onUpdated?.(snapshot);
            } else {
                setStatus({ type: 'error', text: REFRESH_FAILED_MSG });
            }
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setStatus({
                type: 'error',
                text: ax.response?.data?.error || 'שגיאה במחיקת הבאנר',
            });
        } finally {
            setBannerLoading(false);
        }
    };

    const startEdit = () => {
        if (!team) return;
        setForm({
            name: team.name,
            description: team.description,
            logoPosition: team.logoPosition,
        });
        setStatus(null);
        setEditing(true);
    };

    const statusRole = status?.type === 'error' ? 'alert' : 'status';

    if (loading) {
        return (
            <div className={variant === 'card' ? 'card mb-4 p-4' : 'mb-3'}>
                <span className="spinner-border spinner-border-sm text-success" aria-hidden="true" />
            </div>
        );
    }

    if (loadError || !team) {
        return (
            <div className={variant === 'card' ? 'card mb-4 p-4' : 'mb-3'}>
                <div className="alert alert-danger py-2 mb-0" role="alert">
                    {loadError || 'לא ניתן לטעון את פרטי הקבוצה'}
                </div>
            </div>
        );
    }

    const wrapperClass = variant === 'card' ? 'card mb-4 p-4' : 'border rounded p-3 bg-white mb-3';
    const inputId = `team-logo-${teamId}-${slug}`;
    const bannerInputId = `team-banner-${teamId}-${slug}`;
    const regionLabel = `ניהול קבוצה (${managerLabel}): ${team.name}`;

    return (
        <div className={wrapperClass} role="region" aria-label={regionLabel}>
            {cropSrc ? (
                <BannerCropModal
                    open
                    imageSrc={cropSrc}
                    onClose={closeCrop}
                    onConfirm={handleBannerCropConfirm}
                />
            ) : null}
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <div>
                    <h3 className={variant === 'card' ? 'h4 mb-1' : 'h6 fw-bold mb-1'}>
                        ניהול קבוצה: {team.name}
                    </h3>
                    <p className="text-muted small mb-0">
                        תצוגת {managerLabel}. לא מוצג למשתמשים רגילים.
                    </p>
                </div>
                {!editing && (
                    <button type="button" className="btn btn-success btn-sm flex-shrink-0" onClick={startEdit}>
                        <i className="bi bi-pencil-fill me-1" aria-hidden="true" />
                        עריכה
                    </button>
                )}
            </div>

            {editing ? (
                <form onSubmit={(e) => void handleSave(e)}>
                    <div className="row g-3 mb-3">
                        <div className="col-md-6">
                            <label className="form-label" htmlFor={`team-name-${teamId}`}>
                                שם הקבוצה
                            </label>
                            <input
                                id={`team-name-${teamId}`}
                                className="form-control"
                                value={form.name}
                                maxLength={TEAM_NAME_MAX_LEN}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="col-12">
                            <label className="form-label" htmlFor={`team-desc-${teamId}`}>
                                תיאור הקבוצה
                            </label>
                            <textarea
                                id={`team-desc-${teamId}`}
                                className="form-control"
                                rows={3}
                                value={form.description}
                                maxLength={TEAM_DESC_MAX_LEN}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="תיאור קצר על הקבוצה (יוצג בדף הקבוצות)"
                            />
                        </div>
                        <div className="col-12">
                            <div className="form-check">
                                <input
                                    id={`team-show-logo-${teamId}`}
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={form.logoPosition !== 'none'}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            logoPosition: e.target.checked ? 'right' : 'none',
                                        }))
                                    }
                                />
                                <label className="form-check-label" htmlFor={`team-show-logo-${teamId}`}>
                                    הצג לוגו ברשימת הקבוצות
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="mb-3">
                        <span className="form-label d-block">לוגו הקבוצה</span>
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                            <div className="position-relative">
                                {logoSrc ? (
                                    <>
                                        <img
                                            src={logoSrc}
                                            alt={`לוגו ${team.name}`}
                                            className="team-logo-preview"
                                            style={{ width: 64, height: 64, objectFit: 'contain' }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-danger btn-sm position-absolute top-0 start-0 p-1"
                                            onClick={() => void handleDeleteLogo()}
                                            title="מחק לוגו"
                                            aria-label="מחק לוגו"
                                            disabled={logoLoading}
                                            hidden={!hasCustomLogo}
                                            style={{
                                                borderRadius: '50%',
                                                transform: 'translate(-30%, -30%)',
                                            }}
                                        >
                                            <i className="bi bi-trash-fill" style={{ fontSize: '10px' }} />
                                        </button>
                                    </>
                                ) : (
                                    <div
                                        className="d-flex align-items-center justify-content-center bg-light rounded"
                                        style={{ width: 64, height: 64 }}
                                    >
                                        <i className="bi bi-image text-muted" aria-hidden="true" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <input
                                    type="file"
                                    id={inputId}
                                    accept="image/*"
                                    className="visually-hidden"
                                    onChange={(e) => void handleLogoUpload(e)}
                                />
                                <label htmlFor={inputId} className="btn btn-secondary btn-sm mb-0">
                                    {logoLoading ? (
                                        <span className="spinner-border spinner-border-sm me-1" />
                                    ) : (
                                        <i className="bi bi-upload me-1" aria-hidden="true" />
                                    )}
                                    {logoSrc ? (hasCustomLogo ? 'החלף לוגו' : 'העלה לוגו משלך') : 'העלה לוגו'}
                                </label>
                                <div className="text-muted small mt-1">מומלץ PNG שקוף</div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-3">
                        <span className="form-label d-block">באנר הקבוצה</span>
                        {bannerSrc ? (
                            <div className="position-relative mb-2">
                                <img
                                    src={bannerSrc}
                                    alt={`באנר ${team.name}`}
                                    className="teams-browse-banner"
                                />
                                <button
                                    type="button"
                                    className="btn btn-danger btn-sm mt-2"
                                    onClick={() => void handleDeleteBanner()}
                                    disabled={bannerLoading}
                                >
                                    מחק באנר
                                </button>
                            </div>
                        ) : null}
                        <input
                            type="file"
                            id={bannerInputId}
                            accept="image/*"
                            className="d-none"
                            disabled={bannerLoading}
                            onChange={handleBannerFilePick}
                        />
                        <label
                            htmlFor={bannerInputId}
                            className={`btn btn-outline-success btn-sm ${bannerLoading ? 'disabled' : ''}`}
                        >
                            {bannerLoading ? (
                                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                            ) : (
                                <i className="bi bi-image me-1" aria-hidden="true" />
                            )}
                            {bannerSrc ? 'החלף באנר' : 'העלה באנר'}
                        </label>
                        <p className="text-muted small mt-2 mb-0">
                            יחס 4:1. לאחר בחירת קובץ תוכלו למרכז ולקרב את התמונה. הקובץ יידחס עד
                            1080×270.
                        </p>
                    </div>

                    {status && (
                        <div
                            className={`alert py-2 ${status.type === 'error' ? 'alert-danger' : 'alert-success'}`}
                            role={statusRole}
                        >
                            {status.text}
                        </div>
                    )}

                    <div className="d-flex gap-2">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setEditing(false);
                                setStatus(null);
                            }}
                        >
                            ביטול
                        </button>
                        <button type="submit" className="btn btn-theme-green ms-auto" disabled={saving}>
                            {saving ? <span className="spinner-border spinner-border-sm" /> : 'שמור שינויים'}
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    {team.description ? (
                        <p className="text-muted mb-3">{team.description}</p>
                    ) : (
                        <p className="text-muted small mb-3">טרם נוסף תיאור לקבוצה.</p>
                    )}
                    <div className="row align-items-center">
                        <div className="col-md-8">
                            <div className="mb-2">
                                <strong>שם:</strong> {team.name}
                            </div>
                        </div>
                        <div className="col-md-4 text-center">
                            {logoSrc ? (
                                <img
                                    src={logoSrc}
                                    alt={`לוגו ${team.name}`}
                                    className="team-logo-display"
                                    style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain' }}
                                />
                            ) : (
                                <div className="text-muted small">טרם הועלה לוגו</div>
                            )}
                        </div>
                    </div>
                    {bannerSrc ? (
                        <img
                            src={bannerSrc}
                            alt={`באנר ${team.name}`}
                            className="teams-browse-banner mt-3"
                        />
                    ) : null}
                    {status && (
                        <div
                            className={`alert py-2 mt-3 mb-0 ${status.type === 'error' ? 'alert-danger' : 'alert-success'}`}
                            role={statusRole}
                        >
                            {status.text}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
