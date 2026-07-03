import type { CookieOptions, Response } from 'express';
import { config } from '../config/env';

export const SESSION_COOKIE = 'rt_session';
export const PLAYER_COOKIE = 'rt_player';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function resolveSameSite(): 'lax' | 'none' | 'strict' {
  if (config.cookieSameSite) return config.cookieSameSite;
  return config.nodeEnv === 'production' ? 'none' : 'lax';
}

function baseCookieOptions(): CookieOptions {
  const isProd = config.nodeEnv === 'production';
  const sameSite = resolveSameSite();
  // ponytail: sameSite=none requires requireApiOrigin on mutating routes — CSRF depends on it
  return {
    httpOnly: true,
    secure: isProd,
    sameSite,
    path: '/',
  };
}

function cookieOptions(maxAge = SEVEN_DAYS_MS): CookieOptions {
  return { ...baseCookieOptions(), maxAge };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, baseCookieOptions());
}

export function setPlayerCookie(res: Response, token: string): void {
  res.cookie(PLAYER_COOKIE, token, cookieOptions(24 * 60 * 60 * 1000));
}

export function clearPlayerCookie(res: Response): void {
  res.clearCookie(PLAYER_COOKIE, baseCookieOptions());
}

/** Session cookie is primary; token in body is Bearer fallback for Safari / in-app browsers.
 *  XSS can exfiltrate sessionStorage Bearer — keep CSP tight; never log auth responses. */
export function authJsonBody(user: unknown, token: string): Record<string, unknown> {
  return { user, token };
}
