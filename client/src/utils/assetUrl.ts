/**
 * Resolve relative asset paths from the API.
 * - `assets/images/...` (teams, player heads) → same origin as the Vite client (public static files)
 * - `/uploads/...` → API server (user uploads)
 * - `http(s)://...` → unchanged
 */
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
  .replace(/\/api\/?$/i, '')
  .replace(/\/$/, '');

function clientOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return import.meta.env.VITE_CLIENT_URL || '';
}

export function resolveAssetUrl(path?: string | null): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const isClientStatic =
    trimmed.startsWith('assets/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('public/') ||
    trimmed.startsWith('/public/');

  const base = (isClientStatic ? clientOrigin() : API_BASE).replace(/\/$/, '');
  if (!base) return undefined;

  const relative = trimmed.replace(/^\/+/, '');

  try {
    return new URL(relative, `${base}/`).href;
  } catch {
    return undefined;
  }
}
