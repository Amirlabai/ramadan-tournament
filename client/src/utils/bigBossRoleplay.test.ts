import { describe, expect, it } from 'vitest'
import {
  BIG_BOSS_ACTIVITY_THRESHOLD,
  isBigBossPublicPath,
  normalizePathname,
  recordBigBossActivity,
  roleplayAuthorizationNumber,
} from './bigBossRoleplay'
import { isPlatformAdmin } from './tournamentUser'
import { mediaDocsNavLabel } from '../config/contactConfig'

describe('big boss role-play routing', () => {
  it('enables only boys public routes', () => {
    expect(isBigBossPublicPath('/')).toBe(true)
    expect(isBigBossPublicPath('/teams/')).toBe(true)
    expect(isBigBossPublicPath('/schedule')).toBe(true)
    expect(isBigBossPublicPath('/profile')).toBe(false)
    expect(isBigBossPublicPath('/admin')).toBe(false)
    expect(isBigBossPublicPath('/girls')).toBe(false)
    expect(isBigBossPublicPath('/world-cup')).toBe(false)
    expect(isBigBossPublicPath('/privacy')).toBe(false)
  })

  it('normalizes trailing slashes', () => {
    expect(normalizePathname('/stats///')).toBe('/stats')
    expect(normalizePathname('')).toBe('/')
  })

  it('creates stable decree numbers per action', () => {
    expect(roleplayAuthorizationNumber('פתיחת קבוצות')).toBe(
      roleplayAuthorizationNumber('פתיחת קבוצות')
    )
    expect(roleplayAuthorizationNumber('פתיחת קבוצות')).not.toBe(
      roleplayAuthorizationNumber('שליחת תגובה')
    )
  })

  it('requests permission on every fifth recorded activity', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    const firstCycle = Array.from({ length: BIG_BOSS_ACTIVITY_THRESHOLD }, () =>
      recordBigBossActivity(storage)
    )
    const secondCycle = Array.from({ length: BIG_BOSS_ACTIVITY_THRESHOLD }, () =>
      recordBigBossActivity(storage)
    )

    expect(firstCycle).toEqual([false, false, false, false, true])
    expect(secondCycle).toEqual(firstCycle)
  })

  it('recovers safely from malformed or unavailable session storage', () => {
    const values = new Map([['bigBossActivityCount', 'not-a-number']])
    const malformedStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const unavailableStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(recordBigBossActivity(malformedStorage)).toBe(false)
    expect(values.get('bigBossActivityCount')).toBe('1')
    expect(
      Array.from({ length: BIG_BOSS_ACTIVITY_THRESHOLD }, () =>
        recordBigBossActivity(unavailableStorage)
      )
    ).toEqual([false, false, false, false, true])
  })

  it('recognizes platform administrators for the gate bypass', () => {
    expect(isPlatformAdmin({ id: '1', displayName: 'Admin', role: 'admin' })).toBe(true)
    expect(isPlatformAdmin({ id: '2', displayName: 'User', role: 'User' })).toBe(false)
  })

  it('keeps role-play credit out of non-role-play media links', () => {
    expect(mediaDocsNavLabel('צלם')).toBe('תיעוד תמונות בחסות צלם')
    expect(mediaDocsNavLabel('צלם', true)).toContain('Big Boss טייקון הכפר')
  })
})
