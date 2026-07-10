import type { User } from '../contexts/AuthContext'
import { HEALTH_DECLARATION_FORM_URL } from '../config/contactConfig'
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

interface MainNavContext {
  isGirls: boolean
  isWorldCup: boolean
  paths: (typeof tournamentPaths)[TournamentSlug]
  user: User | null
  showAdminNav: boolean
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
      label: user.displayName || 'פרופיל',
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
