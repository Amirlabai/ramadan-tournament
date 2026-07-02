import { worldCupEnabled, worldCupOnly } from './worldCupEnabled';

export type TournamentSlug = 'boys' | 'girls' | 'worldcup';

const STORAGE_KEY = 'preferredTournament';

export const tournamentPaths = {
  boys: {
    home: '/',
    teams: '/teams',
    schedule: '/schedule',
    stats: '/stats',
    mvps: '/mvps',
    archive: '/archive',
    label: 'טורניר כדורגל',
  },
  girls: {
    home: '/girls',
    teams: '/teams-girls',
    news: '/news-girls',
    archive: '/archive-girls',
    label: 'טורניר בנות (נקודות)',
  },
  worldcup: {
    home: '/world-cup',
    teams: '/world-cup/teams',
    schedule: '/world-cup/schedule',
    stats: '/world-cup/stats',
    label: 'מונדיאל 2026',
  },
} as const;

export function slugFromPathname(pathname: string): TournamentSlug {
  if (pathname === '/world-cup' || pathname.startsWith('/world-cup/')) return 'worldcup';
  if (pathname === '/girls' || pathname.includes('-girls')) return 'girls';
  return 'boys';
}

export function readPreferredTournament(): TournamentSlug | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'girls' || v === 'boys' || v === 'worldcup') {
    if (v === 'worldcup' && !worldCupEnabled) return null;
    return v;
  }
  return null;
}

export function writePreferredTournament(slug: TournamentSlug): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, slug);
}

export function homePathForSlug(slug: TournamentSlug): string {
  return tournamentPaths[slug].home;
}

export function availableTournamentSlugs(): TournamentSlug[] {
  if (worldCupOnly) return ['worldcup'];
  const slugs: TournamentSlug[] = ['boys', 'girls'];
  if (worldCupEnabled) slugs.push('worldcup');
  return slugs;
}

/** Home path for legal chrome and outbound links when TournamentProvider is unavailable. */
export function siteHomePath(): string {
  if (worldCupOnly) return tournamentPaths.worldcup.home;
  const preferred = readPreferredTournament();
  if (preferred) return homePathForSlug(preferred);
  return tournamentPaths.boys.home;
}

/** Site title for legal chrome / footer when not inside a tournament route. */
export function siteBrandLabel(): string {
  if (worldCupOnly) return tournamentPaths.worldcup.label;
  return 'מונדיאל קיץ 2026';
}
