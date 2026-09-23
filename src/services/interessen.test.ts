import { describe, expect, it } from 'vitest'
import { INTEREST_GRUPPEN, INTERESTS, MAX_INTERESSEN } from './types'
import { passtZusammen } from './matching'

/** Die zwölf Interessen, die es vor der Erweiterung gab – in gespeicherten Profilen. */
const BISHER = ['Bücher', 'Musik', 'Wandern', 'Kochen', 'Filme', 'Technik', 'Sport', 'Reisen', 'Kunst', 'Games', 'Politik', 'Tiere']

describe('Interessen', () => {
  it('enthalten alle bisherigen Werte unverändert', () => {
    for (const alt of BISHER) expect(INTERESTS).toContain(alt)
  })

  it('sind 35 bis 45, ohne Doppelte, jede Gruppe nicht leer', () => {
    expect(INTERESTS.length).toBeGreaterThanOrEqual(35)
    expect(INTERESTS.length).toBeLessThanOrEqual(45)
    expect(new Set(INTERESTS).size).toBe(INTERESTS.length)
    for (const gruppe of INTEREST_GRUPPEN) expect(gruppe.interessen.length).toBeGreaterThan(0)
  })

  it('bleiben bei höchstens fünf', () => {
    expect(MAX_INTERESSEN).toBe(5)
  })

  it('alte und neue Begriffe passen in der Suche zusammen', () => {
    const gegenueber = { uid: 'x', language: 'de', interests: ['Bücher', 'Tiere'], wantsInterests: ['Bücher', 'Tiere'], bevorzugt: false }
    expect(passtZusammen(gegenueber, { language: 'de', interests: ['Tiere', 'Podcasts'] }, ['Tiere', 'Podcasts'])).toBe(true)
    expect(passtZusammen(gegenueber, { language: 'de', interests: ['Podcasts'] }, ['Podcasts'])).toBe(false)
  })
})
