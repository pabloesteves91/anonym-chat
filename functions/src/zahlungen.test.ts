import { describe, expect, it } from 'vitest'
import { aboEndeEintrag, betragText, testkaufEintrag, zahlungEintrag } from './zahlungsnachricht'

describe('Zahlungen auf Discord', () => {
  it('schreibt Beträge in Franken', () => {
    expect(betragText(790, 'chf')).toBe('CHF 7.90')
    expect(betragText(17900, 'chf')).toBe('CHF 179.00')
    expect(betragText(null, 'chf')).toBe('–')
  })

  it('nennt Tarif, Betrag und Laufzeit – die Person nur als Kurzkennung', () => {
    const e = zahlungEintrag({ uid: 'abcdef123456', plan: 'plus-monat', rappen: 790, waehrung: 'chf', bis: '2026-10-24T00:00:00.000Z', test: true })
    expect(e.title).toBe('🧪 Testzahlung: Plus (Monat)')
    expect(e.fields).toEqual([
      { name: 'Konto', value: 'Konto abcdef', inline: true },
      { name: 'Betrag', value: 'CHF 7.90', inline: true },
      { name: 'Gültig bis', value: '24.10.2026', inline: true },
    ])
    expect(JSON.stringify(e)).not.toContain('abcdef123456')
  })

  it('Lifetime läuft nicht ab, echte Zahlungen heissen nicht Test', () => {
    const e = zahlungEintrag({ uid: 'x', plan: 'lifetime', rappen: 17900, waehrung: 'chf', bis: null, test: false })
    expect(e.title).toBe('💳 Neue Zahlung: Lifetime')
    expect(e.fields?.[2].value).toBe('unbefristet')
    expect(aboEndeEintrag({ uid: 'abcdef99', test: false }).title).toBe('Abo beendet – zurück auf Gratis')
    expect(aboEndeEintrag({ uid: 'abcdef99', test: true, lifetime: true }).title).toBe('🧪 Abo beendet – Lifetime bleibt')
  })
})

describe('Testkauf', () => {
  it('meldet echtes Geld ohne Tarif', () => {
    const e = testkaufEintrag({ uid: 'abcdef123', rappen: 50, waehrung: 'chf', test: false })
    expect(e.title).toBe('💳 Testkauf (kein Tarif)')
    expect(e.fields?.[1].value).toBe('CHF 0.50')
  })
})
