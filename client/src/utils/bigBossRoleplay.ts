export const BIG_BOSS_EN = 'Big Boss'
export const BIG_BOSS_HE = 'טייקון הכפר'
export const BIG_BOSS_TITLE = `${BIG_BOSS_EN} ${BIG_BOSS_HE}`

const BOYS_PUBLIC_PATHS = new Set([
  '/',
  '/teams',
  '/schedule',
  '/stats',
  '/mvps',
  '/archive',
])

export function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

export function isBigBossPublicPath(pathname: string): boolean {
  return BOYS_PUBLIC_PATHS.has(normalizePathname(pathname))
}

export function describeRoleplayAction(element: HTMLElement): string {
  const explicit =
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.getAttribute('data-roleplay-action')
  if (explicit?.trim()) return explicit.trim()

  const text = element.textContent?.replace(/\s+/g, ' ').trim()
  if (text) return text.slice(0, 80)

  if (element instanceof HTMLInputElement) {
    return element.placeholder || element.name || 'שינוי שדה'
  }
  if (element instanceof HTMLSelectElement) return element.name || 'בחירת אפשרות'
  if (element instanceof HTMLTextAreaElement) return element.placeholder || element.name || 'עריכת טקסט'
  if (element instanceof HTMLAnchorElement) return 'פתיחת קישור'
  return 'ביצוע פעולה'
}

export function roleplayAuthorizationNumber(action: string): string {
  let hash = 88
  for (const char of action) {
    hash = (hash * 31 + char.charCodeAt(0)) % 10000
  }
  return `88-${String(hash).padStart(4, '0')}`
}
