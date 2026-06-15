import type { User } from '../contexts/AuthContext'
import { tournamentPaths, type TournamentSlug } from './tournamentPaths'

export interface NavItem {
  to: string
  label: string
  className?: string
}

interface MainNavContext {
  isGirls: boolean
  isWorldCup: boolean
  paths: (typeof tournamentPaths)[TournamentSlug]
  user: User | null
  isAdmin: boolean
}

export function getMainNavItems(ctx: MainNavContext): NavItem[] {
  const { isGirls, isWorldCup, paths, user, isAdmin } = ctx
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
      { to: 'mvps' in paths ? paths.mvps : '/mvps', label: 'MVPs' },
      { to: paths.home ?? '/', label: 'דף הבית' },
      { to: 'teams' in paths ? paths.teams : '/teams', label: 'קבוצות' },
      { to: 'schedule' in paths ? paths.schedule : '/schedule', label: 'משחקים' },
      { to: 'stats' in paths ? paths.stats : '/stats', label: 'סטטיסטיקות' },
      { to: 'archive' in paths ? paths.archive : '/archive', label: 'ארכיון' }
    )
  }

  items.push({ to: '/accessibility', label: 'נגישות' })

  if (user) {
    items.push({
      to: '/profile',
      label: user.displayName || 'פרופיל',
      className: 'login-link',
    })
  } else {
    items.push({ to: '/login', label: 'התחברות', className: 'login-link' })
  }

  if (isAdmin) {
    items.push({ to: '/admin', label: 'ניהול' })
  }

  return items
}

export function getNavIndex(pathname: string, items: NavItem[]): number {
  const normalized = pathname.replace(/\/$/, '') || '/'
  return items.findIndex((item) => {
    const itemPath = item.to.replace(/\/$/, '') || '/'
    return itemPath === normalized
  })
}
