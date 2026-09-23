import { describe, expect, it } from 'vitest'
import {
  NEUE_AKTION,
  RELEASE_VORLAGE,
  aktionsStand,
  besterRabatt,
  dauerText,
  gratisBis,
  hinweis,
  laufendeAktionen,
  normiereCode,
  pruefeAktion,
  rabattiert,
  tarifeText,
  type Aktion,
} from './aktion'
import { grenzen, GRATIS_MITGLIEDSCHAFT } from './plans'

const TAG = 86_400_000
const START = Date.parse('2026-10-01T00:00:00.000Z')
const aktion = (patch: Partial<Aktion> = {}): Aktion => ({
  ...RELEASE_VORLAGE,
  id: 'akt_1',
  aktiv: true,
  start: new Date(START).toISOString(),
  ...patch,
})

describe('aktionsStand', () => {
  it('tut nichts, wenn die Aktion aus ist – auch mit Datum', () => {
    const stand = aktionsStand(aktion({ aktiv: false }), START + TAG)
    expect(stand.gratis).toBe(false)
    expect(stand.rabatt).toBe(0)
  })

  it('tut vor dem Start nichts und nennt den Starttag', () => {
    const stand = aktionsStand(aktion(), START - 1)
    expect(stand.gratis).toBe(false)
    expect(stand.startetAm?.getTime()).toBe(START)
  })

  it('Release: 14 Tage gratis, 30 Tage 20 % – ab Start zugleich', () => {
    expect(aktionsStand(aktion(), START)).toMatchObject({ gratis: true, rabatt: 20 })
    expect(aktionsStand(aktion(), START + 14 * TAG - 1).gratis).toBe(true)
    expect(aktionsStand(aktion(), START + 14 * TAG)).toMatchObject({ gratis: false, rabatt: 20 })
    expect(aktionsStand(aktion(), START + 30 * TAG)).toMatchObject({ rabatt: 0, vorbei: true })
  })

  it('macht mit Gutscheincode nichts gratis', () => {
    expect(aktionsStand(aktion({ code: 'TEST' }), START).gratis).toBe(false)
  })
})

describe('mehrere Aktionen', () => {
  const sommer = aktion({ id: 'sommer', gratisTage: 0, rabattProzent: 30, rabattTage: 10, tarife: ['plus-jahr'] })

  it('nimmt pro Tarif den höchsten Rabatt, ohne zu addieren', () => {
    const liste = [aktion(), sommer]
    expect(besterRabatt(liste, 'plus-jahr', START)?.prozent).toBe(30)
    expect(besterRabatt(liste, 'plus-monat', START)?.prozent).toBe(20)
    expect(besterRabatt(liste, 'frei', START)).toBeNull()
  })

  it('fällt nach dem Ende einer Aktion auf die andere zurück', () => {
    expect(besterRabatt([aktion(), sommer], 'plus-jahr', START + 10 * TAG)?.prozent).toBe(20)
  })

  it('ist gratis bis zum spätesten Gratisende', () => {
    const lang = aktion({ id: 'lang', gratisTage: 20 })
    expect(gratisBis([aktion(), lang], START)?.getTime()).toBe(START + 20 * TAG - 1)
    expect(gratisBis([sommer], START)).toBeNull()
  })

  it('listet nur laufende Aktionen', () => {
    const geplant = aktion({ id: 'spaeter', start: new Date(START + 5 * TAG).toISOString() })
    expect(laufendeAktionen([aktion(), geplant], START).map((a) => a.id)).toEqual(['akt_1'])
  })
})

describe('Texte', () => {
  it('nennt die Abo-Dauer passend zum Tarif', () => {
    expect(dauerText({ aboDauer: 'einmal', aboMonate: 1 }, 'plus-monat')).toBe('im ersten Monat')
    expect(dauerText({ aboDauer: 'einmal', aboMonate: 1 }, 'plus-jahr')).toBe('im ersten Jahr')
    expect(dauerText({ aboDauer: 'monate', aboMonate: 3 }, 'plus-monat')).toBe('in den ersten 3 Monaten')
    expect(dauerText({ aboDauer: 'dauerhaft', aboMonate: 1 }, 'plus-monat')).toMatch(/dauerhaft/)
    expect(dauerText({ aboDauer: 'einmal', aboMonate: 1 }, 'lifetime')).toBeNull()
  })

  it('fasst die Tarife zusammen', () => {
    expect(tarifeText(['plus-monat', 'plus-jahr', 'lifetime'])).toBe('alle Tarife')
    expect(tarifeText(['lifetime', 'plus-monat'])).toBe('Plus monatlich und Lifetime')
  })

  it('nimmt den eigenen Hinweis, wenn es einen gibt', () => {
    const eigen = aktion({ hinweisTitel: 'Wir sind da!', hinweisText: 'Alles gratis.' })
    expect(hinweis(eigen, START)).toEqual({ titel: 'Wir sind da!', punkte: ['Alles gratis.'] })
    // Für die FAQ zählen die Fakten, nicht der Werbetext.
    expect(hinweis(eigen, START, false).titel).toBe('Gerade ist alles gratis.')
  })
})

describe('rabattiert', () => {
  it('rechnet wie Stripe: auf den Rappen gerundet', () => {
    expect(rabattiert(790, 20)).toBe(632)
    expect(rabattiert(6900, 20)).toBe(5520)
    expect(rabattiert(17900, 20)).toBe(14320)
  })
})

describe('pruefeAktion', () => {
  const gut = { ...NEUE_AKTION, name: 'Test' }

  it('lässt eine vernünftige Aktion durch', () => {
    expect(pruefeAktion(gut)).toBeNull()
    expect(pruefeAktion({ ...RELEASE_VORLAGE })).toBeNull()
  })

  it('verlangt Name, Datum zum Einschalten und eine Wirkung', () => {
    expect(pruefeAktion({ ...gut, name: ' ' })).toMatch(/Namen/)
    expect(pruefeAktion({ ...gut, aktiv: true })).toMatch(/Startdatum/)
    expect(pruefeAktion({ ...gut, rabattProzent: 0, gratisTage: 0 })).toMatch(/bewirkt nichts/)
    expect(pruefeAktion({ ...gut, tarife: [] })).toMatch(/Tarif/)
  })

  it('prüft Gutscheincodes', () => {
    expect(pruefeAktion({ ...gut, code: 'SOMMER25' })).toBeNull()
    expect(pruefeAktion({ ...gut, code: 'AB' })).toMatch(/Code/)
    expect(pruefeAktion({ ...gut, code: 'SOMMER 25' })).toMatch(/Code/)
    expect(pruefeAktion({ ...gut, code: 'GRATIS', gratisTage: 5 })).toMatch(/gratis/)
  })

  it('weist Werte ausserhalb der Grenzen ab', () => {
    expect(pruefeAktion({ ...gut, rabattProzent: 95 })).not.toBeNull()
    expect(pruefeAktion({ ...gut, rabattTage: 1.5 })).not.toBeNull()
    expect(pruefeAktion({ ...gut, aboDauer: 'monate', aboMonate: 30 })).not.toBeNull()
  })

  it('vereinheitlicht Codes', () => {
    expect(normiereCode('  sommer 25 ')).toBe('SOMMER25')
  })
})

describe('Tarifgrenzen während einer Gratisaktion', () => {
  it('gibt Gratiskonten in der Gratiszeit alles aus Plus', () => {
    const g = grenzen(GRATIS_MITGLIEDSCHAFT, START + TAG, [aktion()])
    expect(g).toEqual({ chatsProTag: null, interessenFilter: true, eigenerName: true, bevorzugt: true })
  })

  it('setzt danach wieder die Gratisgrenzen', () => {
    expect(grenzen(GRATIS_MITGLIEDSCHAFT, START + 14 * TAG, [aktion()]).chatsProTag).toBe(10)
  })

  it('ändert ohne Aktion nichts', () => {
    expect(grenzen(GRATIS_MITGLIEDSCHAFT, START + TAG, []).chatsProTag).toBe(10)
  })
})
