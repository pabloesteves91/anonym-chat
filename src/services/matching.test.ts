import { describe, expect, it } from 'vitest'
import { nachVorrang, passtZusammen, type Wartend } from './matching'
import type { MatchFilter } from './types'

const wartend = (patch: Partial<Wartend> = {}): Wartend => ({
  uid: 'a',
  language: 'de',
  interests: ['Musik'],
  wantsInterests: [],
  bevorzugt: false,
  ...patch,
})

const filter = (patch: Partial<MatchFilter> = {}): MatchFilter => ({
  language: 'egal',
  interests: [],
  ...patch,
})

describe('passtZusammen', () => {
  it('lässt ohne Filter jeden zu', () => {
    expect(passtZusammen(wartend(), filter(), [])).toBe(true)
  })

  it('hält eine andere Sprache fern', () => {
    expect(passtZusammen(wartend({ language: 'fr' }), filter({ language: 'de' }), [])).toBe(false)
  })

  it('verlangt mindestens eine gemeinsame Vorliebe', () => {
    expect(passtZusammen(wartend({ interests: ['Kochen'] }), filter({ interests: ['Musik'] }), [])).toBe(false)
    expect(passtZusammen(wartend({ interests: ['Musik', 'Kochen'] }), filter({ interests: ['Musik'] }), [])).toBe(true)
  })

  it('achtet auch auf die Wünsche der Gegenseite', () => {
    const anderer = wartend({ wantsInterests: ['Wandern'] })
    expect(passtZusammen(anderer, filter(), ['Musik'])).toBe(false)
    expect(passtZusammen(anderer, filter(), ['Wandern'])).toBe(true)
  })
})

describe('nachVorrang', () => {
  it('stellt zahlende Konten nach vorn, ohne jemanden zu verlieren', () => {
    const liste = [wartend({ uid: 'a' }), wartend({ uid: 'b', bevorzugt: true }), wartend({ uid: 'c' })]
    expect(nachVorrang(liste).map((e) => e.uid)).toEqual(['b', 'a', 'c'])
    expect(nachVorrang(liste)).toHaveLength(3)
  })

  it('lässt die übergebene Liste unangetastet', () => {
    const liste = [wartend({ uid: 'a' }), wartend({ uid: 'b', bevorzugt: true })]
    nachVorrang(liste)
    expect(liste.map((e) => e.uid)).toEqual(['a', 'b'])
  })
})
