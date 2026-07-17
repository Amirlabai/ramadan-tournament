import type { User } from '../contexts/AuthContext'
import {
  HEALTH_DECLARATION_FORM_URL,
  MEDIA_DOCS_SPONSORS,
  mediaDocsNavLabel,
} from '../config/contactConfig'
import { tournamentPaths, type TournamentSlug } from './tournamentPaths'

export type NavActionIndicator = 'profile' | 'admin'

export interface NavItem {
  to: string
  label: string
  className?: string
  showActionDot?: boolean
  actionIndicator?: NavActionIndicator
  external?: boolean
}

/** Primary bottom-tab item (profile slot is handled separately in MobileBottomNav). */
export interface MobilePrimaryNavItem extends NavItem {
  icon: string
}

interface MainNavContext {
  isGirls: boolean
  isWorldCup: boolean
  paths: (typeof tournamentPaths)[TournamentSlug]
  user: User | null
  showAdminNav: boolean
}

function mediaDocsNavItems(): NavItem[] {
  return MEDIA_DOCS_SPONSORS.flatMap((sponsor) => {
    const name = sponsor.name.trim()
    const url = sponsor.url.trim()
    // External-only CTA: require an absolute http(s) URL so a bad value never
    // renders a button that resolves to an in-app route.
    if (!name || !/^https?:\/\//i.test(url)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[mediaDocsNavItems] Skipped sponsor — needs a name and an http(s) url:`,
          sponsor
        )
      }
      return []
    }
    return [
      {
        to: url,
        label: mediaDocsNavLabel(name),
        external: true,
        className: 'media-docs-link',
      },
    ]
  })
}

export function getMainNavItems(ctx: MainNavContext): NavItem[] {
  const { isGirls, isWorldCup, paths, user, showAdminNav } = ctx
  const items: NavItem[] = []

  if (isWorldCup) {
    items.push(
      { to: paths.home ?? '/world-cup', label: 'דף הבית' },
      { to: 'teams' in paths ? paths.teams : '/world-cup/teams', label: 'נבחרות' },
      { to: 'schedule' in paths ? paths.schedule : '/world-cup/schedule', label: 'משחקים' },
      { to: 'stats' in paths ? paths.stats : '/world-cup/stats', label: 'סטטיסטיקות' }
    )
  } else if (isGirls) {
    items.push(
      { to: paths.home ?? '/girls', label: 'דף הבית' },
      { to: 'teams' in paths ? paths.teams : '/teams-girls', label: 'קבוצות' }
    )
    if ('news' in paths && paths.news) {
      items.push({ to: paths.news, label: 'חדשות' })
    }
    if ('archive' in paths && paths.archive) {
      items.push({ to: paths.archive, label: 'ארכיון' })
    }
  } else {
    items.push(
      {
        to: HEALTH_DECLARATION_FORM_URL,
        label: 'הצהרת בריאות לשחקנים',
        external: true,
        className: 'health-form-link',
      },
      ...mediaDocsNavItems(),
      { to: 'mvps' in paths ? paths.mvps : '/mvps', label: 'MVPs' },
      { to: paths.home ?? '/', label: 'דף הבית' },
      { to: 'teams' in paths ? paths.teams : '/teams', label: 'קבוצות' },
      { to: 'schedule' in paths ? paths.schedule : '/schedule', label: 'משחקים' },
      { to: 'stats' in paths ? paths.stats : '/stats', label: 'סטטיסטיקות' },
      { to: 'archive' in paths ? paths.archive : '/archive', label: 'ארכיון' }
    )
  }

  if (user) {
    items.push({
      to: '/profile',
      label: 'פרופיל שלי',
      className: 'login-link',
      actionIndicator: 'profile',
    })
  } else {
    items.push({ to: '/login', label: 'התחברות', className: 'login-link' })
  }

  if (showAdminNav) {
    items.push({ to: '/admin', label: 'ניהול', actionIndicator: 'admin' })
  }

  return items
}

export function applyNavActionDots(
  items: NavItem[],
  flags: { profile: boolean; admin: boolean }
): NavItem[] {
  return items.map((item) => {
    if (item.actionIndicator === 'profile') {
      return { ...item, showActionDot: flags.profile }
    }
    if (item.actionIndicator === 'admin') {
      return { ...item, showActionDot: flags.admin }
    }
    return item
  })
}

export function getNavIndex(pathname: string, items: NavItem[]): number {
  const normalized = pathname.replace(/\/$/, '') || '/'
  return items.findIndex((item) => {
    const itemPath = item.to.replace(/\/$/, '') || '/'
    return itemPath === normalized
  })
}

function normalizePath(path: string): string {
  return path.replace(/\/$/, '') || '/'
}

/**
 * Mobile bottom-bar tabs (RTL right→left): Home, Teams, Schedule/Archive, Stats (boys/WC), then Profile in UI.
 * News stays in NewsBanner — never included here. Admin is via profile chooser, not a tab.
 */
export function getMobilePrimaryNavItems(
  ctx: Pick<MainNavContext, 'isGirls' | 'isWorldCup' | 'paths'>
): MobilePrimaryNavItem[] {
  const { isGirls, isWorldCup, paths } = ctx

  if (isWorldCup) {
    return [
      { to: paths.home ?? '/world-cup', label: 'דף הבית', icon: 'bi-house' },
      { to: 'teams' in paths ? paths.teams : '/world-cup/teams', label: 'נבחרות', icon: 'bi-people' },
      {
        to: 'schedule' in paths ? paths.schedule : '/world-cup/schedule',
        label: 'משחקים',
        icon: 'bi-calendar3',
      },
      {
        to: 'stats' in paths ? paths.stats : '/world-cup/stats',
        label: 'סטטיסטיקות',
        icon: 'bi-bar-chart',
      },
    ]
  }

  if (isGirls) {
    const items: MobilePrimaryNavItem[] = [
      { to: paths.home ?? '/girls', label: 'דף הבית', icon: 'bi-house' },
      { to: 'teams' in paths ? paths.teams : '/teams-girls', label: 'קבוצות', icon: 'bi-people' },
    ]
    if ('archive' in paths && paths.archive) {
      items.push({ to: paths.archive, label: 'ארכיון', icon: 'bi-archive' })
    }
    return items
  }

  return [
    { to: paths.home ?? '/', label: 'דף הבית', icon: 'bi-house' },
    { to: 'teams' in paths ? paths.teams : '/teams', label: 'קבוצות', icon: 'bi-people' },
    { to: 'schedule' in paths ? paths.schedule : '/schedule', label: 'משחקים', icon: 'bi-calendar3' },
    { to: 'stats' in paths ? paths.stats : '/stats', label: 'סטטיסטיקות', icon: 'bi-bar-chart' },
  ]
}

/** Paths covered by the mobile bottom bar (including profile/login). */
export function getMobilePrimaryPaths(
  ctx: Pick<MainNavContext, 'isGirls' | 'isWorldCup' | 'paths'>
): Set<string> {
  const primary = getMobilePrimaryNavItems(ctx)
  const paths = new Set(primary.map((item) => normalizePath(item.to)))
  paths.add('/profile')
  paths.add('/login')
  return paths
}

/** Drawer overflow on mobile: full main nav minus bottom-bar destinations. */
export function filterMobileOverflowNavItems(
  items: NavItem[],
  ctx: Pick<MainNavContext, 'isGirls' | 'isWorldCup' | 'paths'>
): NavItem[] {
  const primaryPaths = getMobilePrimaryPaths(ctx)
  return items.filter((item) => !primaryPaths.has(normalizePath(item.to)))
}
