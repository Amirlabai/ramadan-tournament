import type { Request, Response, NextFunction } from 'express';
import { respondNotFound } from '../utils/respondNotFound';
import { getAllowedOrigins } from '../config/corsOrigins';

export { getAllowedOrigins } from '../config/corsOrigins';

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
        // Browser cookie clients must send Origin/Referer; Bearer-only clients pass above.
        respondNotFound(res);
        return;
      }
      next();
      return;
    }

    if (origin && !originAllowed(origin, allowedOrigins)) {
      respondNotFound(res);
      return;
    }

    if (!origin && referer && !refererAllowed(referer, allowedOrigins)) {
      respondNotFound(res);
      return;
    }

    next();
  };
}
