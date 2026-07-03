/** Single source for default browser origins (CORS + requireApiOrigin). */
export const DEFAULT_CORS_ORIGINS =
  'http://localhost:5173,http://localhost:3000,https://ramadan-tournament-client.vercel.app,https://kksummer-wc.vercel.app';

export function parseCorsOrigins(raw?: string): string[] {
  return (raw?.trim() ? raw : DEFAULT_CORS_ORIGINS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAllowedOrigins(): string[] {
  return parseCorsOrigins(process.env.CORS_ORIGINS);
}
