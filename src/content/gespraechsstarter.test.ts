import { describe, expect, it } from 'vitest'
import { GESPRAECHSSTARTER, KATEGORIE_LABEL, VORSCHLAEGE_ANZAHL, zieheVorschlaege } from './gespraechsstarter'
import { scanText } from '../services/wordFilter'

describe('Gesprächsstarter', () => {
  it('hat mindestens 60, ohne Doppelte, in allen Kategorien', () => {
    expect(GESPRAECHSSTARTER.length).toBeGreaterThanOrEqual(60)
    expect(new Set(GESPRAECHSSTARTER.map((s) => s.text)).size).toBe(GESPRAECHSSTARTER.length)
    for (const kategorie of Object.keys(KATEGORIE_LABEL)) {
      expect(GESPRAECHSSTARTER.some((s) => s.kategorie === kategorie)).toBe(true)
    }
  })

  it('besteht jeder den Wortfilter', () => {
    for (const { text } of GESPRAECHSSTARTER) expect(scanText(text), text).toBeNull()
  })

  it('fragt nie nach Identität oder einer anderen Plattform', () => {
    const verboten = /wie heisst du|wo wohnst du|wie alt|nummer|insta|snap|whatsapp|telegram|adresse|arbeitgeber|nachname/i
    for (const { text } of GESPRAECHSSTARTER) expect(text).not.toMatch(verboten)
  })

  it('zieht drei verschiedene, und beim Nachladen andere', () => {
    const erste = zieheVorschlaege()
    expect(erste).toHaveLength(VORSCHLAEGE_ANZAHL)
    expect(new Set(erste.map((s) => s.text)).size).toBe(VORSCHLAEGE_ANZAHL)
    const zweite = zieheVorschlaege(undefined, erste.map((s) => s.text))
    expect(zweite.some((s) => erste.some((e) => e.text === s.text))).toBe(false)
  })

  it('kommt auch mit einem Zufall am Rand zurecht', () => {
    expect(zieheVorschlaege(3, [], () => 0.999999)).toHaveLength(3)
    expect(zieheVorschlaege(3, [], () => 0)).toHaveLength(3)
  })
})
