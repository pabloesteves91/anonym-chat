import { describe, expect, it } from 'vitest'
import { scanText } from './wordFilter'

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
