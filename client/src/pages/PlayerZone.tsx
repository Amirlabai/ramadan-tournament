import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { playerAPI } from '../api/client';
import type { Player } from '../types';
import { PlayerHeadImg } from '../components/PlayerHeadImg';
import { resolveAssetUrl } from '../utils/assetUrl';
import { BIRTH_YEAR_MAX, BIRTH_YEAR_MIN, isBirthYearInRange, sanitizeBirthYearInput } from '../utils/birthYearInput';
import { isValidIsraeliId, sanitizePersonalIdInput } from '../utils/israeliIdValidation';
import SEO from '../components/SEO';
import { trackEvent } from '../utils/analytics';
import './PlayerZone.css';

type PlayerZonePlayer = Pick<
    Player,
    | 'memberId'
    | 'firstName'
    | 'lastName'
    | 'head_photo'
    | 'pending_head_photo'
    | 'position'
    | 'isCaptain'
    | 'isTeamOwner'
    | 'squadRole'
> & { teamId: number; teamName: string };

const PlayerZone = () => {
    const navigate = useNavigate();
    const [personalId, setPersonalId] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [player, setPlayer] = useState<PlayerZonePlayer | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState('');
    const previewObjectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (previewObjectUrlRef.current) {
                URL.revokeObjectURL(previewObjectUrlRef.current);
            }
        };
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!isValidIsraeliId(personalId)) {
            setError('מספר תעודת זהות לא תקין');
            return;
        }
        if (!isBirthYearInRange(birthYear)) {
            setError(`שנת לידה חייבת להיות בין ${BIRTH_YEAR_MIN} ל-${BIRTH_YEAR_MAX}`);
            return;
        }
        setLoading(true);
        trackEvent('player_zone_login_submit', { category: 'player_zone' });
        try {
            const res = await playerAPI.login(personalId, birthYear);
            setPlayer(res.data.player);

            if (res.data.player.pending_head_photo) {
                setPreview(resolveAssetUrl(res.data.player.pending_head_photo) ?? null);
                setSuccessMsg('התמונה שלך ממתינה לאישור מנהל.');
            } else if (res.data.player.head_photo) {
                setPreview(resolveAssetUrl(res.data.player.head_photo) ?? null);
            } else {
                setPreview(null);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'שגיאה בהתחברות. וודא שהפרטים נכונים.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        trackEvent('photo_upload_start', { category: 'player_zone' });
        if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current);
        }
        const objectUrl = URL.createObjectURL(selectedFile);
        previewObjectUrlRef.current = objectUrl;
        setPreview(objectUrl);
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await playerAPI.uploadPhoto(formData);
            setSuccessMsg('התמונה הועלתה בהצלחה וממתינה לאישור מנהל! מועבר לקבוצות...');
            setPreview(resolveAssetUrl(res.data.url) ?? null);
            setFile(null);

            // Redirect to Teams page after short delay
            setTimeout(() => {
                navigate('/teams');
            }, 1500);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'שגיאה בהעלאת התמונה');
        } finally {
            setLoading(false);
        }
    };

    const canLogin = isValidIsraeliId(personalId) && isBirthYearInRange(birthYear);
    const idFieldInvalid = personalId.length > 0 && !isValidIsraeliId(personalId);
    const yearFieldInvalid = birthYear.length > 0 && !isBirthYearInRange(birthYear);

    return (
        <div className="player-zone-container container py-5">
            <SEO
                title="אזור שחקנים"
                description="אזור אישי לשחקני טורניר רמדאן 2026. העלאת תמונות פרופיל, עדכון פרטים וצפייה בסטטיסטיקות אישיות."
                pathname="/player-zone"
                noindex
            />
            <h2 className="text-center mb-4 text-success fw-bold">אזור אישי לשחקנים</h2>

            {!player ? (
                <div className="card shadow-sm mx-auto" style={{ maxWidth: '400px' }}>
                    <div className="card-body p-4">
                        <h4 className="card-title text-center mb-2">הזדהות</h4>
                        <p className="small text-muted text-center mb-4">
                            כניסה באמצעות תעודת זהות ושנת לידה — ראה{' '}
                            <Link to="/privacy#identity">מדיניות הפרטיות</Link>.
                        </p>
                        <form onSubmit={handleLogin}>
                            <div className="mb-3">
                                <label htmlFor="personalId" className="form-label">תעודת זהות</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className={`form-control${idFieldInvalid ? ' identity-field--invalid' : personalId.length === 0 ? ' identity-field--pending' : ''}`}
                                    id="personalId"
                                    value={personalId}
                                    onChange={(e) => setPersonalId(sanitizePersonalIdInput(e.target.value))}
                                    maxLength={9}
                                    dir="ltr"
                                    required
                                    aria-invalid={idFieldInvalid}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="birthYear" className="form-label">שנת לידה</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className={`form-control${yearFieldInvalid ? ' identity-field--invalid' : birthYear.length === 0 ? ' identity-field--pending' : ''}`}
                                    id="birthYear"
                                    value={birthYear}
                                    onChange={(e) => setBirthYear(sanitizeBirthYearInput(e.target.value))}
                                    maxLength={4}
                                    placeholder={`${BIRTH_YEAR_MIN}–${BIRTH_YEAR_MAX}`}
                                    dir="ltr"
                                    required
                                    aria-invalid={yearFieldInvalid}
                                />
                            </div>
                            {error && <div className="alert alert-danger" role="alert">{error}</div>}
                            <button
                                type="submit"
                                className="btn btn-success btn-gated w-100"
                                disabled={loading || !canLogin}
                                aria-describedby={!canLogin && !loading ? 'player-zone-login-hint' : undefined}
                            >
                                {loading ? 'מתחבר...' : 'כניסה'}
                            </button>
                            {!canLogin && !loading && (
                                <p
                                    id="player-zone-login-hint"
                                    className={`identity-validation-hint mt-2 mb-0${personalId.length > 0 || birthYear.length > 0 ? ' identity-validation-hint--blocked' : ''}`}
                                >
                                    {personalId.length === 0 && birthYear.length === 0
                                        ? 'הזן תעודת זהות (9 ספרות) ושנת לידה כדי להמשיך'
                                        : 'יש להשלים תעודת זהות תקינה ושנת לידה בטווח המותר'}
                                </p>
                            )}
                        </form>
                    </div>
                </div>
            ) : (
                <div className="card shadow-sm mx-auto" style={{ maxWidth: '500px' }}>
                    <div className="card-body p-4 text-center">
                        <h3 className="mb-3">שלום, {player.firstName} {player.lastName}</h3>
                        <p className="text-muted mb-4">{player.teamName}</p>

                        <div className="mb-4">
                            <div className="photo-preview-container mx-auto mb-3">
                                <PlayerHeadImg
                                    player={player}
                                    srcOverride={preview}
                                    alt={`תמונת פרופיל של ${player.firstName} ${player.lastName}`}
                                    style={{ opacity: player.pending_head_photo && preview ? 0.7 : 1 }}
                                />
                                {player.pending_head_photo && preview && (
                                    <div className="photo-preview-pending">
                                        ממתין לאישור
                                    </div>
                                )}
                            </div>

                            <input
                                type="file"
                                id="photo-upload"
                                className="d-none"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                            <label htmlFor="photo-upload" className="btn btn-outline-primary mb-3">
                                {preview ? 'החלף תמונה' : 'בחר תמונה'}
                            </label>

                            {file && (
                                <div className="d-grid gap-2">
                                    <button onClick={handleUpload} className="btn btn-success" disabled={loading}>
                                        {loading ? 'מעלה...' : 'שמור תמונה'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {successMsg && <div className="alert alert-success" role="alert">{successMsg}</div>}
                        {error && <div className="alert alert-danger" role="alert">{error}</div>}

                        <div className="mt-4 pt-3 border-top">
                            <button onClick={async () => {
                                await playerAPI.logout();
                                if (previewObjectUrlRef.current) {
                                    URL.revokeObjectURL(previewObjectUrlRef.current);
                                    previewObjectUrlRef.current = null;
                                }
                                setPlayer(null);
                                setPreview(null);
                                setFile(null);
                                setSuccessMsg('');
                            }} className="btn btn-link text-danger text-decoration-none">
                                התנתק
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerZone;
