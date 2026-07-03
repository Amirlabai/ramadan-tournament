import type { Request } from 'express';

export type AuthPlatform = 'ios' | 'android' | 'desktop';

export function platformFromUserAgent(req: Request): AuthPlatform {
  const ua =
    req?.headers && typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
