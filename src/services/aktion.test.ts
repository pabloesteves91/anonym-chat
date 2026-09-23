import { describe, expect, it } from 'vitest'
import { AKTION_STANDARD, aktionsStand, pruefeAktion, rabattiert, type Aktion } from './aktion'
import { grenzen, GRATIS_MITGLIEDSCHAFT } from './plans'

const TAG = 86_400_000
const START = Date.parse('2026-10-01T00:00:00.000Z')
const aktion = (patch: Partial<Aktion> = {}): Aktion => ({
  ...AKTION_STANDARD,
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
    expect(stand.rabatt).toBe(0)
    expect(stand.startetAm?.getTime()).toBe(START)
  })

  it('ist ab Start gratis und rabattiert – beides zugleich', () => {
    const stand = aktionsStand(aktion(), START)
    expect(stand.gratis).toBe(true)
    expect(stand.rabatt).toBe(20)
  })

  it('beendet die Gratiszeit nach 14 Tagen, den Rabatt nach 30', () => {
    expect(aktionsStand(aktion(), START + 14 * TAG - 1).gratis).toBe(true)
    expect(aktionsStand(aktion(), START + 14 * TAG).gratis).toBe(false)
    expect(aktionsStand(aktion(), START + 14 * TAG).rabatt).toBe(20)
    expect(aktionsStand(aktion(), START + 30 * TAG - 1).rabatt).toBe(20)
    expect(aktionsStand(aktion(), START + 30 * TAG).rabatt).toBe(0)
  })

  it('nennt den letzten Tag einschliesslich', () => {
    const stand = aktionsStand(aktion(), START)
    expect(stand.gratisBis?.getTime()).toBe(START + 14 * TAG - 1)
    expect(stand.rabattBis?.getTime()).toBe(START + 30 * TAG - 1)
  })

  it('lässt einzelne Teile mit 0 weg', () => {
    expect(aktionsStand(aktion({ gratisTage: 0 }), START).gratis).toBe(false)
    expect(aktionsStand(aktion({ rabattProzent: 0 }), START).rabatt).toBe(0)
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
  it('verlangt zum Einschalten ein Datum', () => {
    expect(pruefeAktion(aktion({ start: null }))).toMatch(/Startdatum/)
    expect(pruefeAktion({ ...AKTION_STANDARD })).toBeNull()
  })

  it('weist Werte ausserhalb der Grenzen ab', () => {
    expect(pruefeAktion(aktion({ gratisTage: -1 }))).not.toBeNull()
    expect(pruefeAktion(aktion({ rabattProzent: 95 }))).not.toBeNull()
    expect(pruefeAktion(aktion({ rabattTage: 1.5 }))).not.toBeNull()
    expect(pruefeAktion(aktion({ gratisTage: NaN }))).not.toBeNull()
  })
})

describe('Tarifgrenzen während der Aktion', () => {
  it('gibt Gratiskonten in der Gratiszeit alles aus Plus', () => {
    const g = grenzen(GRATIS_MITGLIEDSCHAFT, START + TAG, aktion())
    expect(g).toEqual({ chatsProTag: null, interessenFilter: true, eigenerName: true, bevorzugt: true })
  })

  it('setzt danach wieder die Gratisgrenzen', () => {
    const g = grenzen(GRATIS_MITGLIEDSCHAFT, START + 14 * TAG, aktion())
    expect(g.chatsProTag).toBe(10)
    expect(g.interessenFilter).toBe(false)
  })

  it('ändert ohne Aktion nichts', () => {
    expect(grenzen(GRATIS_MITGLIEDSCHAFT, START + TAG, AKTION_STANDARD).chatsProTag).toBe(10)
  })
})
