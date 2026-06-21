import type { CookieOptions, Response } from 'express';
import { config } from '../config/env';

export const SESSION_COOKIE = 'rt_session';
export const PLAYER_COOKIE = 'rt_player';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(maxAge = SEVEN_DAYS_MS): CookieOptions {
  const isProd = config.nodeEnv === 'production';
  // ponytail: sameSite=none requires requireApiOrigin on mutating routes — CSRF depends on it
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge,
    path: '/',
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function setPlayerCookie(res: Response, token: string): void {
  res.cookie(PLAYER_COOKIE, token, cookieOptions(24 * 60 * 60 * 1000));
}

export function clearPlayerCookie(res: Response): void {
  res.clearCookie(PLAYER_COOKIE, cookieOptions(24 * 60 * 60 * 1000));
}

/** Dev/Postman only — omit token from JSON in production. */
export function authJsonBody(user: unknown, token: string): Record<string, unknown> {
  const body: Record<string, unknown> = { user };
  if (config.nodeEnv !== 'production') {
    body.token = token;
  }
  return body;
}
