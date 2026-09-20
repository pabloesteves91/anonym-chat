import { describe, expect, it } from 'vitest'
import { scanText, validateDisplayName } from './wordFilter'

describe('scanText', () => {
  it('lässt unauffällige Nachrichten durch', () => {
    expect(scanText('Schönen Abend noch, das war ein gutes Gespräch.')).toBeNull()
    expect(scanText('')).toBeNull()
  })

  it('erkennt Kontaktdaten trotz Ziffern und Sonderzeichen', () => {
    // Regression: die Leetspeak-Normalisierung hat @ und 0 ersetzt und damit
    // genau die Muster zerstört, die danach suchen.
    expect(scanText('schreib mir an max.muster@beispiel.ch')?.level).toBe('mild')
    expect(scanText('ruf an: 079 123 45 67')?.level).toBe('mild')
    expect(scanText('schau mal auf https://beispiel.ch')?.level).toBe('mild')
  })

  it('erkennt Altersangaben unter 18 als schweren Treffer', () => {
    expect(scanText('ich bin 15 jahre alt')?.level).toBe('severe')
    expect(scanText('bin 14')?.level).toBe('severe')
  })

  it('hält volljährige Altersangaben für unauffällig', () => {
    expect(scanText('ich bin 34')).toBeNull()
    expect(scanText('bin 22 und wohne in Bern')).toBeNull()
  })

  it('löst Leetspeak bei Wörtern auf', () => {
    expect(scanText('du 1d10t')?.reason).toBe('Beleidigung')
  })

  it('lässt schwere Treffer gegenüber milden gewinnen', () => {
    const verdict = scanText('du idiot, ich bin 15')
    expect(verdict?.level).toBe('severe')
    expect(verdict?.reason).toBe('Hinweis auf minderjährige Person')
  })

  it('benennt den Treffer für die Anzeige', () => {
    expect(scanText('schreib mir auf telegram')).toMatchObject({
      level: 'mild',
      reason: 'Spam, Werbung oder Weiterleitung',
    })
  })
})

describe('validateDisplayName', () => {
  it('nimmt gewöhnliche Namen an', () => {
    expect(validateDisplayName('Blauer Falke 4417').ok).toBe(true)
    expect(validateDisplayName('Lea M.').ok).toBe(true)
    expect(validateDisplayName('Nacht-Wanderer').ok).toBe(true)
  })

  it('achtet auf Länge und Zeichen', () => {
    expect(validateDisplayName('ab').ok).toBe(false)
    expect(validateDisplayName('x'.repeat(30)).ok).toBe(false)
    expect(validateDisplayName('Lea 😀').ok).toBe(false)
    expect(validateDisplayName('aaaaaahhh').ok).toBe(false)
  })

  it('lässt keine Kontaktdaten im Namen zu', () => {
    expect(validateDisplayName('insta lea99')).toMatchObject({ ok: true })
    expect(validateDisplayName('telegram lea').ok).toBe(false)
    expect(validateDisplayName('lea@mail.ch').ok).toBe(false)
  })

  it('lässt keine sexuellen oder beleidigenden Namen zu', () => {
    expect(validateDisplayName('geiler Typ').ok).toBe(false)
    expect(validateDisplayName('du idiot').ok).toBe(false)
  })
})

describe('Kategorien', () => {
  it('benennt die Art des Treffers für Warnung und Meldegrund', () => {
    expect(scanText('hast du nacktbilder')?.category).toBe('sexuell')
    expect(scanText('ich bin 15')?.category).toBe('minderjaehrig')
    expect(scanText('schreib mir auf telegram')?.category).toBe('spam')
  })
})
