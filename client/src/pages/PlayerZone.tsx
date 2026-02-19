
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerAPI } from '../api/client';
import './PlayerZone.css';

interface Player {
    memberId: number;
    firstName: string;
    lastName: string;
    teamId: number;
    teamName: string;
    head_photo?: string;
    pending_head_photo?: string;
}

const PlayerZone = () => {
    const navigate = useNavigate();
    const [personalId, setPersonalId] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [player, setPlayer] = useState<Player | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState('');

    // Check if already logged in? 
    // Since we don't have a specific "getMe" for players implemented in backend yet (only login returns it),
    // we rely on login. Or we could persist player info in localStorage.

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await playerAPI.login(personalId, birthYear);
            localStorage.setItem('token', res.data.token);
            setPlayer(res.data.player);
            const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

            if (res.data.player.pending_head_photo) {
                setPreview(`${apiUrl}${res.data.player.pending_head_photo}`);
                setSuccessMsg('התמונה שלך ממתינה לאישור מנהל.');
            } else if (res.data.player.head_photo) {
                // If it's a relative path, prefix it. If valid URL, use as is.
                // Backend returns `/uploads/players/...`
                // We need to make sure we point to server URL if it's not absolute.
                // Assuming proxy or base URL handles it? 

                // If head_photo is already a full URL (e.g. cloudinary), use it. otherwise prepend api url
                const photoUrl = res.data.player.head_photo.startsWith('http')
                    ? res.data.player.head_photo
                    : `${apiUrl}${res.data.player.head_photo}`;
                setPreview(photoUrl);
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
        const objectUrl = URL.createObjectURL(selectedFile);
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
            // Update preview with new URL from server to confirm
            const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');
            setPreview(`${apiUrl}${res.data.url}`);
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

    return (
        <div className="player-zone-container container py-5">
            <h2 className="text-center mb-4 text-success fw-bold">אזור אישי לשחקנים</h2>

            {!player ? (
                <div className="card shadow-sm mx-auto" style={{ maxWidth: '400px' }}>
                    <div className="card-body p-4">
                        <h4 className="card-title text-center mb-4">הזדהות</h4>
                        <form onSubmit={handleLogin}>
                            <div className="mb-3">
                                <label htmlFor="personalId" className="form-label">תעודת זהות</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="personalId"
                                    value={personalId}
                                    onChange={(e) => setPersonalId(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="birthYear" className="form-label">שנת לידה</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="birthYear"
                                    value={birthYear}
                                    onChange={(e) => setBirthYear(e.target.value)}
                                    required
                                />
                            </div>
                            {error && <div className="alert alert-danger">{error}</div>}
                            <button type="submit" className="btn btn-success w-100" disabled={loading}>
                                {loading ? 'מתחבר...' : 'כניסה'}
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="card shadow-sm mx-auto" style={{ maxWidth: '500px' }}>
                    <div className="card-body p-4 text-center">
                        <h3 className="mb-3">שלום, {player.firstName} {player.lastName}</h3>
                        <p className="text-muted mb-4">{player.teamName}</p>

                        <div className="mb-4">
                            <div className="photo-preview-container mx-auto mb-3" style={{ width: '150px', height: '150px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#f0f0f0', border: '3px solid #198754' }}>
                                {preview ? (
                                    <>
                                        <img src={preview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: player.pending_head_photo ? 0.7 : 1 }} />
                                        {player.pending_head_photo && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: 'rgba(0,0,0,0.3)',
                                                color: 'white',
                                                fontWeight: 'bold',
                                                textShadow: '0 1px 2px black'
                                            }}>
                                                ממתין לאישור
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                                        <i className="bi bi-person-fill" style={{ fontSize: '4rem' }}></i>
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

                        {successMsg && <div className="alert alert-success">{successMsg}</div>}
                        {error && <div className="alert alert-danger">{error}</div>}

                        <div className="mt-4 pt-3 border-top">
                            <button onClick={() => {
                                setPlayer(null);
                                localStorage.removeItem('token');
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
