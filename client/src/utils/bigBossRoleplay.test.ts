import { describe, expect, it } from 'vitest'
import {
  isBigBossPublicPath,
  normalizePathname,
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

  it('recognizes platform administrators for the gate bypass', () => {
    expect(isPlatformAdmin({ id: '1', displayName: 'Admin', role: 'admin' })).toBe(true)
    expect(isPlatformAdmin({ id: '2', displayName: 'User', role: 'User' })).toBe(false)
  })

  it('keeps role-play credit out of non-role-play media links', () => {
    expect(mediaDocsNavLabel('צלם')).toBe('תיעוד תמונות בחסות צלם')
    expect(mediaDocsNavLabel('צלם', true)).toContain('Big Boss טייקון הכפר')
  })
})
