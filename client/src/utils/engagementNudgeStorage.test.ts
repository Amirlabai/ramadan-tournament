import { describe, expect, it } from 'vitest'
import { jerusalemDateKey } from '@ramadan-tournament/shared'
import { wasShownOnJerusalemDate } from './engagementNudgeStorage'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('daily Big Boss decree storage', () => {
  it('matches the Jerusalem calendar day', () => {
    const storage = new MemoryStorage()
    const firstVisit = new Date('2026-07-21T20:30:00.000Z')
    const nextDay = new Date('2026-07-22T20:30:00.000Z')
    storage.setItem('decree', jerusalemDateKey(firstVisit))

    expect(wasShownOnJerusalemDate(storage, 'decree', firstVisit)).toBe(true)
    expect(wasShownOnJerusalemDate(storage, 'decree', nextDay)).toBe(false)
  })
})
