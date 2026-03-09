import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { authAPI } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

const Login = () => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [identifier, setIdentifier] = useState(''); // Email or Username
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const from = location.state?.from?.pathname || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLoginView) {
                // Backend decides if it's email or legacy username internally 
                // based on whether it contains an @ symbol etc.
                const isEmail = identifier.includes('@');
                const credentials = isEmail
                    ? { email: identifier, password }
                    : { username: identifier, password };

                const response = await authAPI.login(credentials);
                login(response.data.token, response.data.user);
            } else {
                // Register
                const payload = {
                    email: identifier,
                    password,
                    displayName
                };
                const response = await authAPI.register(payload);
                login(response.data.token, response.data.user);
            }
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.error || 'שגיאה בהתחברות. נסה שוב.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setError('');
        setLoading(true);
        try {
            const response = await authAPI.googleLogin(credentialResponse.credential);
            login(response.data.token, response.data.user);
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.error || 'שגיאה בהתחברות עם גוגל');
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card card">
                <h2 className="mb-4 text-center">
                    {isLoginView ? 'התחברות למערכת' : 'הרשמה חדשה'}
                </h2>

                <div className="mb-4 d-flex justify-content-center">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('התחברות גוגל נכשלה')}
                        theme="filled_black"
                        text={isLoginView ? 'signin_with' : 'signup_with'}
                        shape="pill"
                    />
                </div>

                <div className="divider mb-4">
                    <span>או עם אימייל</span>
                </div>

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

                    {error && <div className="alert alert-danger p-2 text-center">{error}</div>}

                    <button type="submit" className="btn btn-primary w-100 mb-3" disabled={loading}>
                        {loading ? (
                            <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                        ) : (
                            isLoginView ? 'התחבר' : 'הרשם'
                        )}
                    </button>

                    <div className="text-center mt-3">
                        <button
                            type="button"
                            className="btn btn-link link-light text-decoration-none"
                            onClick={() => {
                                setIsLoginView(!isLoginView);
                                setError('');
                            }}
                        >
                            {isLoginView ? 'אין לך חשבון? הרשם עכשיו' : 'כבר יש לך חשבון? התחבר'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
