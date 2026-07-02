import type { Response } from 'express';

/** Generic 404 — conceals existence of protected resources from unauthorized callers. */
export function respondNotFound(res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
