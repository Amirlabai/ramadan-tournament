export const BIG_BOSS_EN = 'Big Boss'
export const BIG_BOSS_HE = 'טייקון הכפר'
export const BIG_BOSS_TITLE = `${BIG_BOSS_EN} ${BIG_BOSS_HE}`
export const BIG_BOSS_ACTIVITY_THRESHOLD = 5

const BIG_BOSS_ACTIVITY_COUNT_KEY = 'bigBossActivityCount'
let fallbackActivityCount = 0

type ActivityStorage = Pick<Storage, 'getItem' | 'setItem'>

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

function sessionActivityStorage(): ActivityStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function nextActivityCount(storedValue: string | null): {
  count: number
  requiresPermission: boolean
} {
  const parsed = Number.parseInt(storedValue ?? '', 10)
  const current =
    Number.isInteger(parsed) && parsed >= 0 && parsed < BIG_BOSS_ACTIVITY_THRESHOLD ? parsed : 0
  const next = current + 1
  const requiresPermission = next >= BIG_BOSS_ACTIVITY_THRESHOLD
  return {
    count: requiresPermission ? 0 : next,
    requiresPermission,
  }
}

export function recordBigBossActivity(
  storage: ActivityStorage | null = sessionActivityStorage()
): boolean {
  if (!storage) {
    const result = nextActivityCount(String(fallbackActivityCount))
    fallbackActivityCount = result.count
    return result.requiresPermission
  }

  try {
    const result = nextActivityCount(storage.getItem(BIG_BOSS_ACTIVITY_COUNT_KEY))
    storage.setItem(BIG_BOSS_ACTIVITY_COUNT_KEY, String(result.count))
    return result.requiresPermission
  } catch {
    const result = nextActivityCount(String(fallbackActivityCount))
    fallbackActivityCount = result.count
    return result.requiresPermission
  }
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
