import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { authAPI } from '../api/client';
import { trackEvent } from '../utils/analytics';
import '../pages/admin/Login.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            trackEvent('forgot_password_submit', { category: 'auth' });
            const response = await authAPI.forgotPassword(email.trim());
            setSuccessMsg(response.data.message);
            setSubmitted(true);
        } catch (err: unknown) {
            const data = (err as { response?: { data?: { error?: string } } }).response?.data;
            setError(data?.error || 'שגיאה בשליחת הבקשה. נסה שוב.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <SEO
                title="שכחת סיסמה"
                description="בקשת איפוס סיסמה למערכת מונדיאל קיץ 2026 כפר כמא."
                pathname="/forgot-password"
                noindex
            />
            <div className="login-card card">
                <h2 className="mb-4 text-center">שכחת סיסמה?</h2>

                {submitted ? (
                    <div>
                        <div className="alert alert-success p-2 text-center" role="status">
                            {successMsg}
                        </div>
                        <p className="text-center text-muted small mb-4">
                            בדוק את תיבת הדואר (כולל ספאם). הקישור בתוקף לשעה.
                        </p>
                        <div className="text-center">
                            <Link to="/login" className="btn btn-primary">
                                חזרה להתחברות
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} aria-busy={loading}>
                        <p className="text-muted small mb-4 text-center">
                            הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.
                        </p>

                        <div className="form-group mb-4">
                            <label htmlFor="forgot-email">אימייל</label>
                            <input
                                type="email"
                                className="form-control"
                                id="forgot-email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                dir="ltr"
                                aria-invalid={!!error}
                                aria-describedby={error ? 'forgot-error' : undefined}
                            />
                        </div>

                        {error && (
                            <div id="forgot-error" className="alert alert-danger p-2 text-center" role="alert">
                                {error}
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary w-100 mb-3" disabled={loading} aria-busy={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                                    <span className="visually-hidden">שולח…</span>
                                </>
                            ) : (
                                'שלח קישור לאיפוס'
                            )}
                        </button>

                        <div className="text-center">
                            <Link to="/login" className="btn btn-link link-secondary text-decoration-none">
                                חזרה להתחברות
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
