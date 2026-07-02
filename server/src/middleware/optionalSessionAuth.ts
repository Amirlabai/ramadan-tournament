import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { SESSION_COOKIE } from '../utils/authCookie';
import { AuthRequest } from './auth';

/** Sets req.userId when a valid user session cookie is present; never rejects. */
export const optionalSessionAuth = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      next();
      return;
    }
    const decoded = jwt.verify(token, config.jwtSecret) as { userId?: string };
    if (decoded.userId) {
      req.userId = decoded.userId;
    }
  } catch {
    // ignore invalid session for optional analytics ingest
  }
  next();
};
