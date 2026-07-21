import {
  isAlbumsDiscoverWeekday,
  isDonationPopupWindow,
  isStatsDiscoverWeekend,
  jerusalemDateKey,
} from '@ramadan-tournament/shared'
import { MEDIA_DOCS_SPONSORS } from '../config/contactConfig'

const DONATION_DATE_KEY = 'donationPopupShownDate'
const DONATION_SESSION_KEY = 'donationPopupShownSession'
const ALBUMS_DATE_KEY = 'albumsDiscoverShownDate'
const ALBUMS_SESSION_KEY = 'albumsDiscoverShownSession'
const STATS_DATE_KEY = 'statsDiscoverShownDate'
const STATS_SESSION_KEY = 'statsDiscoverShownSession'
const BIG_BOSS_DECREE_DATE_KEY = 'bigBossDecreeShownDate'

export function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    /* ignore quota / private mode */
  }
}

function alreadyShown(dateKey: string, sessionKey: string, now: Date): boolean {
  if (readStorage(sessionStorage, sessionKey) === '1') return true
  const todayKey = jerusalemDateKey(now)
  return readStorage(localStorage, dateKey) === todayKey
}

function markShown(dateKey: string, sessionKey: string, now: Date = new Date()): void {
  writeStorage(localStorage, dateKey, jerusalemDateKey(now))
  writeStorage(sessionStorage, sessionKey, '1')
}

export function shouldOfferDonationPopup(now: Date = new Date()): boolean {
  if (!isDonationPopupWindow(now)) return false
  return !alreadyShown(DONATION_DATE_KEY, DONATION_SESSION_KEY, now)
}

export function markDonationPopupShown(now: Date = new Date()): void {
  markShown(DONATION_DATE_KEY, DONATION_SESSION_KEY, now)
}

export function hasMediaDocsSponsors(): boolean {
  return MEDIA_DOCS_SPONSORS.some((sponsor) => {
    const name = sponsor.name.trim()
    const url = sponsor.url.trim()
    return Boolean(name && /^https?:\/\//i.test(url))
  })
}

export function shouldOfferAlbumsDiscover(now: Date = new Date()): boolean {
  if (!isAlbumsDiscoverWeekday(now)) return false
  if (!hasMediaDocsSponsors()) return false
  return !alreadyShown(ALBUMS_DATE_KEY, ALBUMS_SESSION_KEY, now)
}

export function markAlbumsDiscoverShown(now: Date = new Date()): void {
  markShown(ALBUMS_DATE_KEY, ALBUMS_SESSION_KEY, now)
}

export function shouldOfferStatsDiscover(
  pathname: string,
  now: Date = new Date()
): boolean {
  if (!isStatsDiscoverWeekend(now)) return false
  const normalized = pathname.replace(/\/$/, '') || '/'
  if (normalized === '/stats') return false
  return !alreadyShown(STATS_DATE_KEY, STATS_SESSION_KEY, now)
}

export function markStatsDiscoverShown(now: Date = new Date()): void {
  markShown(STATS_DATE_KEY, STATS_SESSION_KEY, now)
}

export function wasShownOnJerusalemDate(
  storage: Storage,
  key: string,
  now: Date = new Date()
): boolean {
  return readStorage(storage, key) === jerusalemDateKey(now)
}

export function shouldOfferBigBossDecree(now: Date = new Date()): boolean {
  return !wasShownOnJerusalemDate(localStorage, BIG_BOSS_DECREE_DATE_KEY, now)
}

export function markBigBossDecreeShown(now: Date = new Date()): void {
  writeStorage(localStorage, BIG_BOSS_DECREE_DATE_KEY, jerusalemDateKey(now))
}
