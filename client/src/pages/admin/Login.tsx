import { useState } from 'react';
import SEO from '../../components/SEO';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { authAPI } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { trackEvent } from '../../utils/analytics';
import { getAuthDiagnostics } from '../../utils/authDiagnostics';
import { finalizeLogin } from '../../utils/authSession';
import './Login.css';

function safeInternalPath(path: unknown): string {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return '/';
    return path;
}

const Login = () => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [isVerifying, setIsVerifying] = useState(false);
    const [identifier, setIdentifier] = useState(''); // Email or Username
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [resendLoading, setResendLoading] = useState(false);

    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const from = safeInternalPath(location.state?.from?.pathname);
    const authSurface = location.pathname.startsWith('/admin') ? 'admin' : 'public';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (isLoginView) {
                trackEvent('login_submit', { category: 'auth', properties: { method: 'password', surface: authSurface } });
                const isEmail = identifier.includes('@');
                const credentials = isEmail
                    ? { email: identifier, password }
                    : { username: identifier, password };

                const response = await authAPI.login(credentials);
                const result = await finalizeLogin(response, 'password');
                if (!result.ok) {
                    setError(result.error);
                    return;
                }
                login(result.user);
                navigate(from, { replace: true });
            } else {
                trackEvent('register_submit', { category: 'auth', properties: { method: 'password', surface: authSurface } });
                // Register
                const payload = {
                    email: identifier,
                    password,
                    displayName
                };
                const response = await authAPI.register(payload);
                if (response.data.needsVerification) {
                    setIsVerifying(true);
                    setSuccessMsg('נרשמת בהצלחה! קוד אימות נשלח לאימייל שלך.');
                } else {
                    const result = await finalizeLogin(response, 'password');
                    if (!result.ok) {
                        setError(result.error);
                        return;
                    }
                    login(result.user);
                    navigate(from, { replace: true });
                }
            }
        } catch (err: any) {
            const data = err.response?.data;
            if (data?.needsVerification) {
                setIsVerifying(true);
                setError('חשבונך טרם אומת. הזן את הקוד שנשלח אליך.');
            } else if (data?.useGoogle) {
                setIsLoginView(true);
                setError(data.error || 'האימייל הזה מקושר להתחברות עם Google. השתמש בכפתור Google למעלה.');
            } else {
                setError(data?.error || 'שגיאה בהתחברות. נסה שוב.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const response = await authAPI.verifyEmail(identifier, verificationCode);
            const result = await finalizeLogin(response, 'password');
            if (!result.ok) {
                setError(result.error);
                return;
            }
            login(result.user);
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.error || 'קוד אימות שגוי או פג תוקף');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        setError('');
        setSuccessMsg('');
        setResendLoading(true);
        try {
            await authAPI.resendVerification(identifier);
            setSuccessMsg('קוד אימות חדש נשלח לאימייל שלך.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'שגיאה בשליחת הקוד');
        } finally {
            setResendLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setError('');
        setLoading(true);
        trackEvent('google_login_click', {
            category: 'auth',
            properties: { method: 'google', surface: authSurface, ...getAuthDiagnostics() },
        });
        try {
            const response = await authAPI.googleLogin(credentialResponse.credential);
            const result = await finalizeLogin(response, 'google');
            if (!result.ok) {
                setError(result.error);
                return;
            }
            login(result.user);
            navigate(from, { replace: true });
        } catch (err: any) {
            const status = err.response?.status;
            trackEvent('google_login_failed', {
                category: 'auth',
                properties: {
                    reason: status ? `http_${status}` : 'client_error',
                    ...getAuthDiagnostics(),
                },
            });
            setError(err.response?.data?.error || 'שגיאה בהתחברות עם גוגל');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        trackEvent('google_login_failed', {
            category: 'auth',
            properties: { reason: 'google_widget_error', ...getAuthDiagnostics() },
        });
        setError('התחברות גוגל נכשלה');
        setLoading(false);
    };

    return (
        <div className="login-page">
            <SEO
                title={isVerifying ? 'אימות אימייל' : (isLoginView ? 'התחברות' : 'הרשמה')}
                description="התחברות ורישום למערכת מונדיאל קיץ 2026 כפר כמא."
                pathname="/login"
                noindex
            />
            <div className="login-card card">
                <h2 className="mb-4 text-center">
                    {isVerifying ? 'אימות אימייל' : (isLoginView ? 'התחברות למערכת' : 'הרשמה חדשה')}
                </h2>

                {!isVerifying && (
                    <div className="mb-4 d-flex justify-content-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            theme="filled_black"
                            text={isLoginView ? 'signin_with' : 'signup_with'}
                            shape="pill"
                        />
                    </div>
                )}

                {!isVerifying && (
                    <div className="divider mb-4">
                        <span>או עם אימייל</span>
                    </div>
                )}

                {isVerifying ? (
                    <form onSubmit={handleVerifySubmit}>
                        <p className="text-center mb-4">הזן את 6 הספרות שנשלחו לכתובת:<br /><strong>{identifier}</strong></p>
                        
                        <div className="form-group mb-4">
                            <label htmlFor="verificationCode" className="form-label">קוד אימות (6 ספרות)</label>
                            <input
                                type="text"
                                id="verificationCode"
                                className="form-control form-control-lg text-center fw-bold"
                                maxLength={6}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                aria-required="true"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                required
                                style={{ letterSpacing: '8px', fontSize: '1.5rem' }}
                            />
                        </div>

                        {error && <div className="alert alert-danger p-2 text-center" role="alert">{error}</div>}
                        {successMsg && <div className="alert alert-success p-2 text-center" role="alert">{successMsg}</div>}

                        <button type="submit" className="btn btn-primary w-100 mb-3" disabled={loading}>
                            {loading ? <span className="spinner-border spinner-border-sm"></span> : 'אמת חשבון'}
                        </button>

                        <div className="text-center">
                            <button
                                type="button"
                                className="btn btn-link link-secondary text-decoration-none"
                                onClick={handleResendCode}
                                disabled={resendLoading}
                            >
                                {resendLoading ? 'שולח...' : 'לא קיבלת קוד? שלח שוב'}
                            </button>
                        </div>
                        
                        <div className="text-center mt-2">
                            <button
                                type="button"
                                className="btn btn-link link-secondary text-decoration-none small"
                                onClick={() => { setIsVerifying(false); setError(''); setSuccessMsg(''); }}
                            >
                                חזור להתחברות
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {!isLoginView && (
                            <div className="form-group mb-3">
                                <label htmlFor="displayName">שם מלא (יוצג בתגובות)</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="displayName"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    required={!isLoginView}
                                />
                            </div>
                        )}

                        <div className="form-group mb-3">
                            <label htmlFor="identifier">
                                {isLoginView ? 'אימייל או שם משתמש' : 'אימייל'}
                            </label>
                            <input
                                type={(!isLoginView || identifier.includes('@')) ? 'email' : 'text'}
                                className="form-control"
                                id="identifier"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                autoComplete={isLoginView ? "username" : "email"}
                                dir="ltr"
                            />
                        </div>

                        <div className="form-group mb-4">
                            <label htmlFor="password">סיסמה</label>
                            <input
                                type="password"
                                className="form-control"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete={isLoginView ? "current-password" : "new-password"}
                                dir="ltr"
                            />
                        </div>

                        {error && <div className="alert alert-danger p-2 text-center" role="alert">{error}</div>}
                        {successMsg && <div className="alert alert-success p-2 text-center" role="alert">{successMsg}</div>}

                        <button type="submit" className="btn btn-primary w-100 mb-3" disabled={loading}>
                            {loading ? (
                                <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                            ) : (
                                isLoginView ? 'התחבר' : 'הרשם'
                            )}
                        </button>

                        <p className="small text-muted text-center mb-3">
                            בהרשמה או התחברות את/ה מסכים/ה ל
                            <Link to="/terms" className="mx-1">
                                תנאי שימוש
                            </Link>
                            ול
                            <Link to="/privacy" className="ms-1">
                                מדיניות פרטיות
                            </Link>
                            .
                        </p>

                        <div className="text-center mt-3">
                            <button
                                type="button"
                                className="btn btn-link link-secondary text-decoration-none"
                                onClick={() => {
                                    setIsLoginView(!isLoginView);
                                    setError('');
                                    setSuccessMsg('');
                                }}
                            >
                                {isLoginView ? 'אין לך חשבון? הרשם עכשיו' : 'כבר יש לך חשבון? התחבר'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
