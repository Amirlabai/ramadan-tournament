import { config } from './env';

export const tournamentBranding = {
  displayNameHe:
    process.env.TOURNAMENT_DISPLAY_NAME_HE?.trim() || 'גביע העולם אדיגה 2026',
  sitePublicUrl:
    process.env.SITE_PUBLIC_URL?.trim().replace(/\/$/, '') ||
    config.corsOrigins.find((o) => o.startsWith('https://')) ||
    'https://ramadan-tournament-client.vercel.app',
};

export function profileUrl(): string {
  return `${tournamentBranding.sitePublicUrl}/profile`;
}

export function adminUrl(): string {
  return `${tournamentBranding.sitePublicUrl}/admin`;
}
