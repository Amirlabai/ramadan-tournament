export type TournamentSlug = 'boys' | 'girls';

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
} as const;

export function slugFromPathname(pathname: string): TournamentSlug {
  if (pathname === '/girls' || pathname.includes('-girls')) return 'girls';
  return 'boys';
}

export function readPreferredTournament(): TournamentSlug | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'girls' || v === 'boys' ? v : null;
}

export function writePreferredTournament(slug: TournamentSlug): void {
  localStorage.setItem(STORAGE_KEY, slug);
}

export function homePathForSlug(slug: TournamentSlug): string {
  return tournamentPaths[slug].home;
}
