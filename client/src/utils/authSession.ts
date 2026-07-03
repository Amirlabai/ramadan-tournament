import axios from 'axios';
import { authAPI } from '../api/client';
import type { User } from '../contexts/AuthContext';
import { getAuthDiagnostics } from './authDiagnostics';
import { clearAuthToken, setAuthToken } from './authToken';
import { trackEvent } from './analytics';

export const SESSION_STICKY_ERROR =
  'הדפדפן לא שמר את ההתחברות. נסה לפתוח את האתר ב-Safari (לא מתוך וואטסאפ/פייסבוק).';

type LoginMethod = 'google' | 'password';

type AuthLoginResponse = {
  data: {
    user: User;
    token?: string;
  };
};

function probeOutcome(err: unknown): string {
  if (!axios.isAxiosError(err)) return 'network_error';
  const status = err.response?.status;
  if (status === 401) return '401';
  if (status === 404) return '404';
  if (status && status >= 500) return '5xx';
  if (status) return `http_${status}`;
  return 'network_error';
}

export async function finalizeLogin(
  response: AuthLoginResponse,
  method: LoginMethod
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  clearAuthToken();
  if (response.data.token) {
    setAuthToken(response.data.token);
  }

  const diagnostics = getAuthDiagnostics();
  let outcome: string;
  try {
    await authAPI.getCurrentUser();
    outcome = 'ok';
  } catch (err) {
    outcome = probeOutcome(err);
  }

  trackEvent('auth_session_probe', {
    category: 'auth',
    properties: { outcome, method, ...diagnostics },
  });

  if (outcome !== 'ok') {
    clearAuthToken();
    if (method === 'google') {
      trackEvent('google_login_failed', {
        category: 'auth',
        properties: { reason: 'session_sticky', outcome, ...diagnostics },
      });
    }
    return { ok: false, error: SESSION_STICKY_ERROR };
  }

  return { ok: true, user: response.data.user };
}
