import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { authAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { trackEvent } from '../utils/analytics';
import '../pages/admin/Login.css';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const navigate = useNavigate();
    const { logout } = useAuth();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError('קישור האיפוס אינו תקין. בקש קישור חדש.');
            return;
        }

        if (password !== confirmPassword) {
            setError('הסיסמאות אינן תואמות');
            return;
        }

        if (password.length < 6) {
            setError('הסיסמה חייבת להכיל לפחות 6 תווים');
            return;
        }

        if (password.length > 128) {
            setError('הסיסמה ארוכה מדי (עד 128 תווים)');
            return;
        }

        setLoading(true);

        try {
            trackEvent('reset_password_submit', { category: 'auth' });
            await authAPI.resetPassword(token, password);
            await logout();
            navigate('/login', {
                replace: true,
                state: { resetSuccess: 'הסיסמה עודכנה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.' },
            });
        } catch (err: unknown) {
            const data = (err as { response?: { data?: { error?: string } } }).response?.data;
            setError(data?.error || 'שגיאה בעדכון הסיסמה. ייתכן שהקישור פג תוקף.');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="login-page">
                <SEO
                    title="איפוס סיסמה"
                    description="בחירת סיסמה חדשה למערכת מונדיאל קיץ 2026 כפר כמא."
                    pathname="/reset-password"
                    noindex
                />
                <div className="login-card card">
                    <h2 className="mb-4 text-center">קישור לא תקין</h2>
                    <div className="alert alert-danger p-2 text-center" role="alert">
                        קישור האיפוס חסר או אינו תקין.
                    </div>
                    <div className="text-center mt-3">
                        <Link to="/forgot-password" className="btn btn-primary me-2">
                            בקש קישור חדש
                        </Link>
                        <Link to="/login" className="btn btn-link link-secondary text-decoration-none">
                            חזרה להתחברות
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <SEO
                title="איפוס סיסמה"
                description="בחירת סיסמה חדשה למערכת מונדיאל קיץ 2026 כפר כמא."
                pathname="/reset-password"
                noindex
            />
            <div className="login-card card">
                <h2 className="mb-4 text-center">בחירת סיסמה חדשה</h2>

                <form onSubmit={handleSubmit} aria-busy={loading}>
                    <div className="form-group mb-3">
                        <label htmlFor="new-password">סיסמה חדשה</label>
                        <input
                            type="password"
                            className="form-control"
                            id="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            maxLength={128}
                            autoComplete="new-password"
                            dir="ltr"
                            aria-invalid={!!error}
                            aria-describedby={error ? 'reset-error' : undefined}
                        />
                    </div>

                    <div className="form-group mb-4">
                        <label htmlFor="confirm-password">אימות סיסמה</label>
                        <input
                            type="password"
                            className="form-control"
                            id="confirm-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            maxLength={128}
                            autoComplete="new-password"
                            dir="ltr"
                            aria-invalid={!!error}
                            aria-describedby={error ? 'reset-error' : undefined}
                        />
                    </div>

                    {error && (
                        <div id="reset-error" className="alert alert-danger p-2 text-center" role="alert">
                            {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary w-100 mb-3" disabled={loading} aria-busy={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                                <span className="visually-hidden">מעדכן…</span>
                            </>
                        ) : (
                            'עדכן סיסמה'
                        )}
                    </button>

                    <div className="text-center">
                        <Link to="/login" className="btn btn-link link-secondary text-decoration-none">
                            חזרה להתחברות
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
