import { describe, expect, it } from 'vitest'
import { darfTestgespraech, istTestRaum, testAntwort } from './testgespraech'
import { scanText } from './wordFilter'

describe('Testgespräch', () => {
  it('nur für die Verwaltung', () => {
    expect(darfTestgespraech({ rolle: 'verwaltung' })).toBe(true)
    expect(darfTestgespraech({ rolle: 'moderation' })).toBe(false)
    expect(darfTestgespraech({ rolle: 'nutzer' })).toBe(false)
    expect(darfTestgespraech(null)).toBe(false)
  })

  it('erkennt Testräume, und nur sie', () => {
    expect(istTestRaum('test-raum_abc')).toBe(true)
    expect(istTestRaum('chat_abc')).toBe(false)
    expect(istTestRaum(null)).toBe(false)
  })

  it('antwortet mit harmlosen Sätzen', () => {
    for (let i = 0; i < 20; i++) expect(scanText(testAntwort(i))).toBeNull()
  })
})
