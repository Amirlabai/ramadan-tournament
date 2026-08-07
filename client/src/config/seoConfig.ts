import { PRIVACY_CONTACT_EMAIL } from './contactConfig'
import {
  SCHEDULE_ROUNDS,
  TOURNAMENT_RULES_TITLE,
} from '../content/circassianTournamentRules'
import { LEGAL_PRERENDER_PATHS } from './legalPaths'

/** Canonical production host (`VITE_SITE_URL` in `.env.production`). */
const DEFAULT_SITE_URL = 'https://kksummer-wc.vercel.app'

export function getSiteUrl(): string {
  const raw = import.meta.env.VITE_SITE_URL as string | undefined
  return (raw?.replace(/\/$/, '') || DEFAULT_SITE_URL).trim()
}

export interface RouteSeo {
  title: string
  description: string
  keywords: string
  /**
   * When true, use `title` as the full document title (no village brand suffix).
   * Use for FIFA World Cup routes that should not pick up כפר כמא.
   */
  branded?: boolean
}

/** Brand used in document titles when the page title is not already branded. */
export const SITE_BRAND_TITLE = 'מונדיאל קיץ 2026 כפר כמא'

/**
 * Short real terms only — Google ignores meta keywords; keep head lean.
 * Ranking copy lives in titles, descriptions, and on-page text.
 */
const BASE_KEYWORDS = [
  'מונדיאל קיץ',
  'טורניר כדורגל',
  'כדור רגל',
  'כפר כמא',
  'כפר קמא',
  'Kfar Kama',
  'מרכז צעירים',
  'לוח משחקים',
  'תוצאות',
].join(', ')

/** Parse `DD/MM/YYYY` from tournament rules into ISO `YYYY-MM-DD`. */
function scheduleDateToIso(date: string): string {
  const [dd, mm, yyyy] = date.split('/')
  return `${yyyy}-${mm}-${dd}`
}

const TOURNAMENT_START_ISO = scheduleDateToIso(SCHEDULE_ROUNDS[0].date)
const TOURNAMENT_END_ISO = scheduleDateToIso(
  SCHEDULE_ROUNDS[SCHEDULE_ROUNDS.length - 1].date
)

/**
 * Full document `<title>`: keep as-is when `branded` or already contains כפר;
 * otherwise append the village brand (fixes girls/legal vs WC inconsistency).
 */
export function formatDocumentTitle(title: string, branded?: boolean): string {
  const resolved = title?.trim() || SITE_BRAND_TITLE
  if (branded || resolved.includes('כפר')) return resolved
  return `${resolved} | ${SITE_BRAND_TITLE}`
}

export const routeSeo: Record<string, RouteSeo> = {
  '/': {
    title: SITE_BRAND_TITLE,
    description:
      'מונדיאל קיץ 2026: טורניר כדורגל (כדור רגל) בכפר כמא / כפר קמא. תוצאות בזמן אמת, לוח משחקים, טבלאות וסטטיסטיקות.',
    keywords: `${BASE_KEYWORDS}, סטטיסטיקות`,
  },
  '/teams': {
    title: 'קבוצות: מונדיאל קיץ כפר כמא',
    description:
      'קבוצות ושחקנים בטורניר הכדורגל מונדיאל קיץ 2026 בכפר כמא (כפר קמא).',
    keywords: `${BASE_KEYWORDS}, קבוצות`,
  },
  '/schedule': {
    title: 'לוח משחקים: מונדיאל קיץ כפר כמא',
    description:
      'לוח משחקים ותוצאות לטורניר כדורגל קיץ בכפר כמא / כפר קמא.',
    keywords: BASE_KEYWORDS,
  },
  '/stats': {
    title: 'סטטיסטיקות: מונדיאל קיץ כפר כמא',
    description:
      'טבלאות, מלכי שערים וסטטיסטיקות למונדיאל קיץ כדורגל כפר כמא.',
    keywords: `${BASE_KEYWORDS}, סטטיסטיקות, שערים`,
  },
  '/mvps': {
    title: 'שחקני העונה: מונדיאל קיץ כפר כמא',
    description: 'שחקני העונה (MVPs) בטורניר כדורגל קיץ בכפר כמא / כפר קמא.',
    keywords: `${BASE_KEYWORDS}, MVP`,
  },
  '/archive': {
    title: 'ארכיון: מונדיאל קיץ כפר כמא',
    description: 'ארכיון עונות קודמות של טורניר הכדורגל בכפר כמא.',
    keywords: `${BASE_KEYWORDS}, ארכיון`,
  },
  '/girls': {
    title: 'טורניר בנות: דף הבית',
    description: 'טורניר בנות (נקודות) בכפר כמא. טבלאות וחדשות.',
    keywords: `${BASE_KEYWORDS}, טורניר בנות, נקודות`,
  },
  '/teams-girls': {
    title: 'קבוצות: טורניר בנות',
    description: 'קבוצות טורניר הבנות בכפר כמא.',
    keywords: `${BASE_KEYWORDS}, טורניר בנות`,
  },
  '/news-girls': {
    title: 'חדשות: טורניר בנות',
    description: 'חדשות ועדכונים מטורניר הבנות בכפר כמא.',
    keywords: `${BASE_KEYWORDS}, חדשות`,
  },
  '/archive-girls': {
    title: 'ארכיון: טורניר בנות',
    description: 'ארכיון עונות טורניר הבנות בכפר כמא.',
    keywords: `${BASE_KEYWORDS}, ארכיון`,
  },
  '/world-cup': {
    title: 'מונדיאל 2026: דף הבית',
    description: 'תוצאות, משחקים קרובים ומלכי השערים למונדיאל 2026.',
    keywords: `${BASE_KEYWORDS}, World Cup`,
    branded: true,
  },
  '/world-cup/teams': {
    title: 'מונדיאל 2026: נבחרות',
    description: 'נבחרות ושחקנים במונדיאל 2026.',
    keywords: `${BASE_KEYWORDS}, נבחרות`,
    branded: true,
  },
  '/world-cup/schedule': {
    title: 'מונדיאל 2026: משחקים',
    description: 'לוח משחקים מלא למונדיאל 2026.',
    keywords: BASE_KEYWORDS,
    branded: true,
  },
  '/world-cup/stats': {
    title: 'מונדיאל 2026: סטטיסטיקות',
    description: 'טבלאות בתים, מלכי השערים ונוקאאוט למונדיאל 2026.',
    keywords: `${BASE_KEYWORDS}, סטטיסטיקות`,
    branded: true,
  },
  '/about': {
    title: 'אודות: מונדיאל קיץ כפר כמא',
    description:
      'אודות מונדיאל קיץ 2026. טורניר כדורגל בכפר כמא / כפר קמא, בחסות מרכז הצעירים.',
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
      'מדיניות פרטיות, עוגיות ופרטי זהות לרישום לטורניר. מונדיאל קיץ 2026 כפר כמא.',
    keywords: `${BASE_KEYWORDS}, פרטיות, privacy`,
  },
  '/terms': {
    title: 'תנאי שימוש',
    description:
      'תנאי שימוש באתר הטורניר: רישום, תוכן משתמש והצבעות.',
    keywords: `${BASE_KEYWORDS}, תנאים`,
  },
  '/rules': {
    title: TOURNAMENT_RULES_TITLE,
    description:
      'תקנון חוקי מונדיאל הצ\'רקסי 2026: שלב בתים, פלייאוף עליון ותחתון, ניקוד, לוח זמנים ומועדי מחזורים.',
    keywords: `${BASE_KEYWORDS}, תקנון, חוקים`,
  },
}

export function getRouteSeo(pathname: string): RouteSeo {
  const normalized = pathname.replace(/\/$/, '') || '/'
  return (
    routeSeo[normalized] ?? {
      title: SITE_BRAND_TITLE,
      description:
        'טורניר כדורגל קיץ בכפר כמא / כפר קמא. תוצאות, טבלאות וסטטיסטיקות.',
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

const TOURNAMENT_ALTERNATE_NAMES = [
  'מונדיאל קיץ כפר כמא',
  'מונדיאל קיץ כפר קמא',
  'מונדיאל כפר כמא',
  'טורניר כדורגל כפר כמא',
  'טורניר כדורגל כפר קמא',
  'טורניר כדור רגל כפר כמא',
  'Kfar Kama Summer World Cup',
]

export function organizationJsonLd() {
  const url = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'מונדיאל קיץ 2026 כפר כמא',
    alternateName: TOURNAMENT_ALTERNATE_NAMES,
    url,
    email: PRIVACY_CONTACT_EMAIL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'כפר כמא',
      addressCountry: 'IL',
    },
  }
}

export function webSiteJsonLd() {
  const url = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'מונדיאל קיץ 2026 כפר כמא',
    alternateName: TOURNAMENT_ALTERNATE_NAMES,
    url,
    inLanguage: 'he',
  }
}

export function webApplicationJsonLd() {
  const url = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'מונדיאל קיץ 2026 כפר כמא',
    alternateName: TOURNAMENT_ALTERNATE_NAMES,
    url,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Any',
    inLanguage: 'he',
  }
}

/** Local summer football tournament — dates from `SCHEDULE_ROUNDS` (group + final). */
export function sportsEventJsonLd() {
  const url = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: 'מונדיאל קיץ 2026 כפר כמא',
    alternateName: TOURNAMENT_ALTERNATE_NAMES,
    description:
      'טורניר כדורגל (כדור רגל) קיץ בכפר כמא / כפר קמא. תוצאות, לוח משחקים וסטטיסטיקות.',
    url,
    startDate: TOURNAMENT_START_ISO,
    endDate: TOURNAMENT_END_ISO,
    sport: 'Soccer',
    image: [`${url}/og-image.png`],
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: 'כפר כמא',
      alternateName: ['כפר קמא', 'Kfar Kama'],
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'כפר כמא',
        addressCountry: 'IL',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: 'מרכז צעירים כפר כמא',
    },
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

/** Indexable public routes (aligned with `generate-sitemap.mjs`; no noindex paths). */
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
  '/about',
  '/accessibility',
  '/privacy',
  '/terms',
  '/rules',
] as const

export { LEGAL_PRERENDER_PATHS }

/** Auth and utility routes excluded from search indexing. */
export const NOINDEX_PATHS = [
  '/login',
  '/admin/login',
  '/forgot-password',
  '/reset-password',
  '/admin',
  '/profile',
  '/player-zone',
] as const

/** Canonical pathname used when prerendering noindex auth aliases. */
export const NOINDEX_CANONICAL_PATHS: Record<string, string> = {
  '/admin/login': '/login',
}
