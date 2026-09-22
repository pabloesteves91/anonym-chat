import { describe, expect, it } from 'vitest'
import { generatePseudonym } from './pseudonym'

/**
 * Der Name ist im Chat das Einzige, was über das Gegenüber etwas aussagt.
 * Er muss deshalb zur Angabe passen – und grammatikalisch stimmen, sonst
 * fällt die Form auf, nicht die Person.
 */
describe('generatePseudonym', () => {
  const vieleNamen = (geschlecht: 'weiblich' | 'maennlich' | null) =>
    Array.from({ length: 200 }, () => generatePseudonym(geschlecht))

  it('gibt weiblichen Konten eine weibliche Form', () => {
    for (const name of vieleNamen('weiblich')) {
      const [adjektiv] = name.split(' ')
      expect(adjektiv.endsWith('e')).toBe(true)
      expect(adjektiv.endsWith('er')).toBe(false)
    }
  })

  it('gibt männlichen Konten eine männliche Form', () => {
    for (const name of vieleNamen('maennlich')) {
      expect(name.split(' ')[0].endsWith('er')).toBe(true)
    }
  })

  it('mischt die beiden Tierlisten nicht', () => {
    const weiblich = new Set(vieleNamen('weiblich').map((n) => n.split(' ')[1]))
    const maennlich = new Set(vieleNamen('maennlich').map((n) => n.split(' ')[1]))
    for (const tier of weiblich) expect(maennlich.has(tier)).toBe(false)
  })

  it('hält die Form Adjektiv + Tier + vierstellige Zahl ein', () => {
    for (const geschlecht of ['weiblich', 'maennlich', null] as const) {
      for (const name of vieleNamen(geschlecht)) {
        expect(name).toMatch(/^[A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+ \d{4}$/)
      }
    }
  })

  it('fällt ohne Angabe auf die männliche Form zurück', () => {
    // Der kurze Moment zwischen Kontoanlage und Angabe im Profil.
    for (const name of vieleNamen(null)) {
      expect(name.split(' ')[0].endsWith('er')).toBe(true)
    }
  })

  it('würfelt und liefert nicht immer dasselbe', () => {
    expect(new Set(vieleNamen('weiblich')).size).toBeGreaterThan(50)
  })
})
