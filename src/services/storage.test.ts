import { afterEach, describe, expect, it, vi } from 'vitest'
import { readJson, readString, writeJson, writeString } from './storage'

const KEY = 'test.eintrag'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('storage', () => {
  it('schreibt und liest Werte', () => {
    expect(writeJson(KEY, { a: 1 })).toBe(true)
    expect(readJson(KEY, null)).toEqual({ a: 1 })
  })

  it('liefert den Fallback für fehlende Schlüssel', () => {
    expect(readJson(KEY, 'fallback')).toBe('fallback')
  })

  it('räumt beschädigte Einträge auf und nutzt den Fallback', () => {
    window.localStorage.setItem(KEY, '{kein json')
    expect(readJson(KEY, 'fallback')).toBe('fallback')
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('meldet fehlgeschlagene Schreibvorgänge, statt zu werfen', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(writeJson(KEY, { a: 1 })).toBe(false)
    expect(() => writeString(KEY, 'x')).not.toThrow()
  })

  it('wirft nicht, wenn der Zugriff gesperrt ist', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readJson(KEY, 'fallback')).toBe('fallback')
    expect(readString(KEY)).toBeNull()
  })
})
