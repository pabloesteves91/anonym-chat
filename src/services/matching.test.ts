import { describe, expect, it } from 'vitest'
import {
  ERWEITERUNG_ANGEBOT_NACH_MS,
  ERWEITERUNG_ERNEUT_NACH_MS,
  SUCHSTATUS_TEXT,
  VIELE_AB,
  erweiterbar,
  erweitereFilter,
  kandidatenFiltern,
  nachVorrang,
  passtZusammen,
  suchstatus,
  type Wartend,
} from './matching'
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

describe('kandidatenFiltern', () => {
  const eintraege = [
    wartend({ uid: 'ich' }),
    wartend({ uid: 'blockiert', interests: ['Musik'] }),
    wartend({ uid: 'passt', interests: ['Musik'] }),
    wartend({ uid: 'anders', interests: ['Kochen'] }),
  ]

  it('schliesst das eigene Konto und Ausgeschlossene immer aus', () => {
    const { kandidaten, passend } = kandidatenFiltern(eintraege, {
      ich: 'ich',
      ausgeschlossen: ['blockiert'],
      filter: filter({ interests: ['Musik'] }),
      meineInteressen: [],
    })
    expect(kandidaten.map((e) => e.uid)).toEqual(['passt', 'anders'])
    expect(passend.map((e) => e.uid)).toEqual(['passt'])
  })

  it('auch nach einer erweiterten Suche bleiben Blockierte ausgeschlossen', () => {
    const erweitert = erweitereFilter(filter({ language: 'de', interests: ['Musik'] }), true)
    const { passend } = kandidatenFiltern(eintraege, {
      ich: 'ich',
      ausgeschlossen: ['blockiert'],
      filter: erweitert,
      meineInteressen: [],
    })
    expect(passend.map((e) => e.uid)).toEqual(['passt', 'anders'])
    expect(passend.map((e) => e.uid)).not.toContain('blockiert')
  })
})

describe('erweitereFilter', () => {
  const eng = filter({ language: 'fr', interests: ['Musik', 'Kochen'] })

  it('ändert ohne Zustimmung nichts', () => {
    expect(erweitereFilter(eng, false)).toBe(eng)
  })

  it('lässt mit Zustimmung nur die Interessen los, nie die Sprache', () => {
    expect(erweitereFilter(eng, true)).toEqual({ language: 'fr', interests: [] })
  })

  it('bietet ohne Interessenfilter nichts zu erweitern', () => {
    expect(erweiterbar(filter({ language: 'de' }))).toBe(false)
    expect(erweiterbar(eng)).toBe(true)
  })

  it('wartet eine benannte Zeit, bevor es fragt', () => {
    expect(ERWEITERUNG_ANGEBOT_NACH_MS).toBeGreaterThanOrEqual(30_000)
    expect(ERWEITERUNG_ERNEUT_NACH_MS).toBeGreaterThan(0)
  })
})

describe('suchstatus', () => {
  it('bleibt neutral, solange nichts gesehen wurde', () => {
    expect(suchstatus(null)).toBe('neutral')
  })

  it('leitet die Stufe aus dem Gesehenen ab, ohne Zahlen', () => {
    expect(suchstatus({ kandidaten: 9, passend: VIELE_AB, filterAktiv: false })).toBe('viele')
    expect(suchstatus({ kandidaten: 2, passend: 1, filterAktiv: false })).toBe('suche')
    expect(suchstatus({ kandidaten: 4, passend: 0, filterAktiv: true })).toBe('filterEng')
    expect(suchstatus({ kandidaten: 0, passend: 0, filterAktiv: true })).toBe('wenige')
    for (const text of Object.values(SUCHSTATUS_TEXT)) expect(text).not.toMatch(/\d/)
  })
})

describe('Interessen nur aus der Suche', () => {
  it('zwei, die beide nach Bücher und Konzerte suchen, finden sich', () => {
    const suche = ['Bücher', 'Konzerte']
    const gegenueber = wartend({ uid: 'b', interests: suche, wantsInterests: suche })
    expect(passtZusammen(gegenueber, filter({ interests: suche }), suche)).toBe(true)
  })

  it('wer mit Interessen sucht, trifft nur andere mit mindestens einem davon', () => {
    const suche = filter({ interests: ['Bücher'] })
    expect(passtZusammen(wartend({ interests: ['Bücher', 'Kochen'] }), suche, ['Bücher'])).toBe(true)
    expect(passtZusammen(wartend({ interests: ['Kochen'] }), suche, ['Bücher'])).toBe(false)
    expect(passtZusammen(wartend({ interests: [] }), suche, ['Bücher'])).toBe(false)
  })

  it('ohne Filter auf beiden Seiten passt es', () => {
    expect(passtZusammen(wartend({ interests: [] }), filter(), [])).toBe(true)
  })
})
