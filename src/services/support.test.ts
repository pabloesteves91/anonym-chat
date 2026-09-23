import { describe, expect, it } from 'vitest'
import {
  BETREFF_MAX,
  SUPPORT_THEMEN,
  TEXT_MAX,
  TEXT_MIN,
  themaLabel,
  validateAntwortadresse,
  validateSupportAnfrage,
} from './support'

const gueltig = {
  thema: 'geschlecht' as const,
  betreff: 'Falsches Geschlecht gewählt',
  text: 'Ich habe bei der Anmeldung versehentlich das falsche Geschlecht angegeben.',
}

describe('validateSupportAnfrage', () => {
  it('nimmt eine vollständige Anfrage an', () => {
    expect(validateSupportAnfrage(gueltig)).toEqual({ ok: true })
  })

  it('besteht auf einem Thema', () => {
    expect(validateSupportAnfrage({ ...gueltig, thema: '' }).ok).toBe(false)
  })

  it('weist erfundene Themen ab', () => {
    // Die Auswahlliste im Browser lässt sich umschreiben; geprüft wird hier.
    expect(validateSupportAnfrage({ ...gueltig, thema: 'erfunden' as never }).ok).toBe(false)
  })

  it('besteht auf einem Betreff und begrenzt ihn', () => {
    expect(validateSupportAnfrage({ ...gueltig, betreff: '   ' }).ok).toBe(false)
    expect(validateSupportAnfrage({ ...gueltig, betreff: 'x'.repeat(BETREFF_MAX) }).ok).toBe(true)
    expect(validateSupportAnfrage({ ...gueltig, betreff: 'x'.repeat(BETREFF_MAX + 1) }).ok).toBe(false)
  })

  it('verlangt eine Beschreibung, die etwas beschreibt', () => {
    expect(validateSupportAnfrage({ ...gueltig, text: 'geht nicht' }).ok).toBe(false)
    expect(validateSupportAnfrage({ ...gueltig, text: 'x'.repeat(TEXT_MIN) }).ok).toBe(true)
    expect(validateSupportAnfrage({ ...gueltig, text: 'x'.repeat(TEXT_MAX + 1) }).ok).toBe(false)
  })

  it('zählt ohne umschliessende Leerzeichen', () => {
    const knapp = `   ${'x'.repeat(TEXT_MIN - 1)}   `
    expect(validateSupportAnfrage({ ...gueltig, text: knapp }).ok).toBe(false)
  })

  it('lässt Kontaktdaten und Verweise stehen', () => {
    // Regression: Der Wortfilter wertet Adressen, Nummern und Links als Spam.
    // In einer Supportanfrage sind das die hilfreichen Angaben – liefe er
    // hier mit, würde er die brauchbarsten Anfragen abweisen.
    const mitKontakt = {
      ...gueltig,
      text: 'Meine alte Adresse war max.muster@beispiel.ch, erreichbar bin ich unter 079 123 45 67.',
    }
    expect(validateSupportAnfrage(mitKontakt)).toEqual({ ok: true })

    const mitLink = { ...gueltig, text: 'Beim Aufruf von https://beispiel.ch/preise sehe ich nur eine leere Seite.' }
    expect(validateSupportAnfrage(mitLink)).toEqual({ ok: true })
  })
})

describe('validateAntwortadresse', () => {
  it('nimmt übliche Adressen an', () => {
    expect(validateAntwortadresse('max@beispiel.ch').ok).toBe(true)
    expect(validateAntwortadresse('max.muster+support@mail.beispiel.co.uk').ok).toBe(true)
  })

  it('weist Leeres und offensichtlich Falsches ab', () => {
    expect(validateAntwortadresse('').ok).toBe(false)
    expect(validateAntwortadresse('   ').ok).toBe(false)
    expect(validateAntwortadresse('max').ok).toBe(false)
    expect(validateAntwortadresse('max@beispiel').ok).toBe(false)
    expect(validateAntwortadresse('max beispiel@ch').ok).toBe(false)
  })
})

describe('SUPPORT_THEMEN', () => {
  it('hat eindeutige Werte und überall einen Hinweis', () => {
    const werte = SUPPORT_THEMEN.map((t) => t.value)
    expect(new Set(werte).size).toBe(werte.length)
    for (const thema of SUPPORT_THEMEN) {
      expect(thema.label.length).toBeGreaterThan(0)
      expect(thema.hint.length).toBeGreaterThan(0)
    }
  })

  it('führt jedes Thema auf einen lesbaren Namen zurück', () => {
    expect(themaLabel('konto-loeschen')).toBe('Konto löschen')
  })
})
