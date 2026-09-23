import { describe, expect, it } from 'vitest'
import {
  ERWEITERUNG_ANGEBOT_NACH_MS,
  ERWEITERUNG_ERNEUT_NACH_MS,
  SUCHSTATUS_TEXT,
  VIELE_AB,
  eigeneInteressen,
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

describe('eigeneInteressen', () => {
  it('zählt, wonach gesucht wird, auch als eigenes Interesse – ohne Doppelte', () => {
    expect(eigeneInteressen(['Bücher', 'Musik'], ['Bücher', 'Konzerte'])).toEqual(['Bücher', 'Musik', 'Konzerte'])
  })

  it('zwei leere Profile, beide suchen Bücher und Konzerte: sie finden sich', () => {
    const suche = ['Bücher', 'Konzerte']
    const a = wartend({ uid: 'a', interests: eigeneInteressen([], suche), wantsInterests: suche })
    const b = wartend({ uid: 'b', interests: eigeneInteressen([], suche), wantsInterests: suche })
    const filterBeider = filter({ interests: suche })
    expect(passtZusammen(b, filterBeider, eigeneInteressen([], suche))).toBe(true)
    expect(passtZusammen(a, filterBeider, eigeneInteressen([], suche))).toBe(true)
  })

  it('findet wie bisher, wer es im Profil hat, und nicht, wer es nirgends hat', () => {
    const suche = filter({ interests: ['Bücher'] })
    const meine = eigeneInteressen([], ['Bücher'])
    expect(passtZusammen(wartend({ interests: ['Bücher'] }), suche, meine)).toBe(true)
    expect(passtZusammen(wartend({ interests: ['Kochen'] }), suche, meine)).toBe(false)
  })
})
