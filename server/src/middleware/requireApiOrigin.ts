import type { Request, Response, NextFunction } from 'express';

export function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS
    || 'http://localhost:5173,http://localhost:3000,https://ramadan-tournament-client.vercel.app')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function originAllowed(origin: string, allowed: string[]): boolean {
  return allowed.includes(origin);
}

function refererAllowed(referer: string, allowed: string[]): boolean {
  try {
    const url = new URL(referer);
    return originAllowed(`${url.protocol}//${url.host}`, allowed);
  } catch {
    return false;
  }
}

/** ponytail: Origin check instead of csurf — blocks cross-site cookie POSTs. */
export function requireApiOrigin(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (!mutating) {
      next();
      return;
    }

    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    if (!origin && !referer) {
      // Intentional pass-through: health checks and unauthenticated public POSTs (e.g. comments)
      if (hasBearer) {
        next();
        return;
      }
      const hasCookie = Boolean(req.cookies?.rt_session || req.cookies?.rt_player);
      if (hasCookie) {
        res.status(403).json({ error: 'Origin required for cookie-authenticated requests' });
        return;
      }
      next();
      return;
    }

    if (origin && !originAllowed(origin, allowedOrigins)) {
      res.status(403).json({ error: 'Invalid origin' });
      return;
    }

    if (!origin && referer && !refererAllowed(referer, allowedOrigins)) {
      res.status(403).json({ error: 'Invalid origin' });
      return;
    }

    next();
  };
}
