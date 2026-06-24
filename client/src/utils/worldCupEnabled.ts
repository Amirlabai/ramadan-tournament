export const worldCupEnabled =
  import.meta.env.VITE_WORLD_CUP_ENABLED === 'true' ||
  import.meta.env.VITE_WORLD_CUP_ENABLED === '1';

const dualTournament =
  import.meta.env.VITE_DUAL_TOURNAMENT === 'true' ||
  import.meta.env.VITE_DUAL_TOURNAMENT === '1';

/** When true, hide local boys/girls tournaments and redirect legacy routes to /world-cup/* */
export const worldCupOnly =
  !dualTournament &&
  worldCupEnabled &&
  (import.meta.env.VITE_WORLD_CUP_ONLY === 'true' ||
    import.meta.env.VITE_WORLD_CUP_ONLY === '1');

const LOCAL_TO_WC: Record<string, string> = {
  '/': '/world-cup',
  '/teams': '/world-cup/teams',
  '/schedule': '/world-cup/schedule',
  '/stats': '/world-cup/stats',
  '/mvps': '/world-cup',
  '/archive': '/world-cup',
};

/** Returns a /world-cup path when worldCupOnly is on and the user hit a local tournament URL. */
export function worldCupOnlyRedirect(pathname: string): string | null {
  if (!worldCupOnly) return null;

  const normalized = pathname.replace(/\/$/, '') || '/';

  if (normalized.startsWith('/world-cup')) return null;

  const allowed = new Set([
    '/login',
    '/admin',
    '/admin/login',
    '/profile',
    '/player-zone',
    '/about',
    '/accessibility',
    '/privacy',
    '/terms',
  ]);
  if (allowed.has(normalized)) return null;

  const mapped = LOCAL_TO_WC[normalized];
  if (mapped) return mapped;

  if (normalized.startsWith('/girls') || normalized.includes('-girls')) {
    return '/world-cup';
  }

  return null;
}
