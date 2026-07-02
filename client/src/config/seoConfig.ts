import { PRIVACY_CONTACT_EMAIL } from './contactConfig'

const DEFAULT_SITE_URL = 'https://ramadan-tournament-client.vercel.app'

export function getSiteUrl(): string {
  const raw = import.meta.env.VITE_SITE_URL as string | undefined
  return (raw?.replace(/\/$/, '') || DEFAULT_SITE_URL).trim()
}

export interface RouteSeo {
  title: string
  description: string
  keywords: string
}

const BASE_KEYWORDS =
  'טורניר, כדורגל, כפר כמא, Ramadan Tournament, Kfar Kama, Football, summer tournament, amir labay, מרכז צעירים'

export const routeSeo: Record<string, RouteSeo> = {
  '/': {
    title: 'דף הבית',
    description:
      'מונדיאל קיץ 2026 כפר כמא — תוצאות בזמן אמת, טבלאות, סטטיסטיקות וחדשות.',
    keywords: `${BASE_KEYWORDS}, תוצאות, לוח משחקים`,
  },
  '/teams': {
    title: 'קבוצות',
    description: 'רשימת קבוצות הטורניר, שחקנים ומידע על כל קבוצה.',
    keywords: `${BASE_KEYWORDS}, קבוצות`,
  },
  '/schedule': {
    title: 'משחקים',
    description: 'לוח משחקים, תוצאות ומיקומים — מונדיאל קיץ 2026.',
    keywords: `${BASE_KEYWORDS}, לוח משחקים, תוצאות`,
  },
  '/stats': {
    title: 'סטטיסטיקות',
    description: 'סטטיסטיקות הטורניר, מלכי השערים ונתוני העונה.',
    keywords: `${BASE_KEYWORDS}, סטטיסטיקות, שערים`,
  },
  '/mvps': {
    title: 'שחקני העונה',
    description: 'שחקני העונה (MVPs) — מונדיאל קיץ 2026.',
    keywords: `${BASE_KEYWORDS}, MVP`,
  },
  '/archive': {
    title: 'ארכיון',
    description: 'ארכיון עונות קודמות של הטורניר.',
    keywords: `${BASE_KEYWORDS}, ארכיון, היסטוריה`,
  },
  '/girls': {
    title: 'טורניר בנות — דף הבית',
    description: 'טורניר בנות (נקודות) — טבלאות וחדשות.',
    keywords: `${BASE_KEYWORDS}, טורניר בנות, נקודות`,
  },
  '/teams-girls': {
    title: 'קבוצות — טורניר בנות',
    description: 'קבוצות טורניר הבנות.',
    keywords: `${BASE_KEYWORDS}, טורניר בנות`,
  },
  '/news-girls': {
    title: 'חדשות — טורניר בנות',
    description: 'חדשות ועדכונים מטורניר הבנות.',
    keywords: `${BASE_KEYWORDS}, חדשות`,
  },
  '/archive-girls': {
    title: 'ארכיון — טורניר בנות',
    description: 'ארכיון עונות טורניר הבנות.',
    keywords: `${BASE_KEYWORDS}, ארכיון`,
  },
  '/world-cup': {
    title: 'מונדיאל 2026 — דף הבית',
    description: 'תוצאות, משחקים קרובים ומלכי השערים — מונדיאל 2026.',
    keywords: `${BASE_KEYWORDS}, מונדיאל, World Cup`,
  },
  '/world-cup/teams': {
    title: 'מונדיאל 2026 — נבחרות',
    description: 'נבחרות ושחקנים — מונדיאל 2026.',
    keywords: `${BASE_KEYWORDS}, נבחרות, מונדיאל`,
  },
  '/world-cup/schedule': {
    title: 'מונדיאל 2026 — משחקים',
    description: 'לוח משחקים מלא — מונדיאל 2026.',
    keywords: `${BASE_KEYWORDS}, משחקים, מונדיאל`,
  },
  '/world-cup/stats': {
    title: 'מונדיאל 2026 — סטטיסטיקות',
    description: 'טבלאות בתים, מלכי השערים ונוקאאוט — מונדיאל 2026.',
    keywords: `${BASE_KEYWORDS}, סטטיסטיקות, מונדיאל`,
  },
  '/about': {
    title: 'אודות',
    description: 'אודות מונדיאל קיץ 2026 כפר כמא — מרכז צעירים.',
    keywords: `${BASE_KEYWORDS}, אודות`,
  },
  '/accessibility': {
    title: 'הצהרת נגישות',
    description:
      'הצהרת נגישות לאתר הטורניר. תקן ת״י 5568, WCAG 2.1 רמה AA, פרטי רכז ודיווח.',
    keywords: `${BASE_KEYWORDS}, נגישות, accessibility`,
  },
  '/privacy': {
    title: 'מדיניות פרטיות',
    description:
      'מדיניות פרטיות, עוגיות ופרטי זהות לרישום לטורניר — מונדיאל קיץ 2026.',
    keywords: `${BASE_KEYWORDS}, פרטיות, privacy`,
  },
  '/terms': {
    title: 'תנאי שימוש',
    description:
      'תנאי שימוש באתר הטורניר — רישום, תוכן משתמש והצבעות.',
    keywords: `${BASE_KEYWORDS}, תנאים`,
  },
}

export function getRouteSeo(pathname: string): RouteSeo {
  const normalized = pathname.replace(/\/$/, '') || '/'
  return (
    routeSeo[normalized] ?? {
      title: 'מונדיאל קיץ 2026',
      description: 'טורניר כפר כמא — תוצאות, טבלאות וסטטיסטיקות.',
      keywords: BASE_KEYWORDS,
    }
  )
}

export function canonicalUrl(pathname: string): string {
  const base = getSiteUrl()
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (path === '/') return `${base}/`
  return `${base}${path}`
}

export function organizationJsonLd() {
  const url = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'מונדיאל קיץ 2026 — כפר כמא',
    url,
    email: PRIVACY_CONTACT_EMAIL,
  }
}

export function webSiteJsonLd() {
  const url = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'מונדיאל קיץ 2026',
    url,
    inLanguage: 'he',
  }
}

export function webApplicationJsonLd() {
  const url = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'מונדיאל קיץ 2026',
    url,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Any',
    inLanguage: 'he',
  }
}

export interface BreadcrumbItem {
  name: string
  path: string
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  const base = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${base}${item.path}`,
    })),
  }
}

export const PUBLIC_SITEMAP_PATHS = [
  '/',
  '/teams',
  '/schedule',
  '/stats',
  '/mvps',
  '/archive',
  '/girls',
  '/teams-girls',
  '/news-girls',
  '/archive-girls',
  '/world-cup',
  '/world-cup/teams',
  '/world-cup/schedule',
  '/world-cup/stats',
  '/player-zone',
  '/about',
  '/accessibility',
  '/privacy',
  '/terms',
] as const

export const LEGAL_PRERENDER_PATHS = [
  '/about',
  '/accessibility',
  '/privacy',
  '/terms',
] as const

/** Auth and utility routes excluded from search indexing. */
export const NOINDEX_PATHS = [
  '/login',
  '/admin/login',
  '/admin',
  '/profile',
  '/player-zone',
] as const

/** Canonical pathname used when prerendering noindex auth aliases. */
export const NOINDEX_CANONICAL_PATHS: Record<string, string> = {
  '/admin/login': '/login',
}
