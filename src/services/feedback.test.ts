import { describe, expect, it } from 'vitest'
import { dauerText, diesenMonat, durchschnittMs, feedbackId, monatVon, nachFeedbackFragen, zuStatistik } from './feedback'

describe('Feedback', () => {
  it('eine Kennung pro Gespräch und Konto', () => {
    expect(feedbackId('chat_1', 'konto')).toBe('chat_1_konto')
  })

  it('fragt nach gewöhnlichem Ende, nicht nach Melden oder Ausschliessen', () => {
    expect(nachFeedbackFragen('selbst')).toBe(true)
    expect(nachFeedbackFragen('partner')).toBe(true)
    expect(nachFeedbackFragen('naechster')).toBe(true)
    expect(nachFeedbackFragen('gemeldet')).toBe(false)
    expect(nachFeedbackFragen('blockiert')).toBe(false)
  })
})

describe('Statistik in der App', () => {
  it('liest nur, was dasteht, und nichts über Unangenehmes', () => {
    const s = zuStatistik({ gespraeche: 4, dauerSummeMs: 400_000, laengsteMs: 200_000, gut: 2, unangenehm: 9, monate: { '2026-09': 3 } })
    expect(s).toEqual({ gespraeche: 4, dauerSummeMs: 400_000, laengsteMs: 200_000, gut: 2, monate: { '2026-09': 3 } })
    expect(durchschnittMs(s)).toBe(100_000)
    expect(diesenMonat(s, Date.UTC(2026, 8, 20))).toBe(3)
    expect(diesenMonat(s, Date.UTC(2026, 9, 20))).toBe(0)
  })

  it('teilt nicht durch null', () => {
    expect(durchschnittMs(zuStatistik(undefined))).toBe(0)
  })

  it('schreibt Dauern lesbar', () => {
    expect(dauerText(45_000)).toBe('45 Sek.')
    expect(dauerText(12 * 60_000)).toBe('12 Min.')
    expect(dauerText(65 * 60_000)).toBe('1 Std. 5 Min.')
    expect(dauerText(120 * 60_000)).toBe('2 Std.')
  })

  it('rechnet den Monat wie der Server', () => {
    expect(monatVon(Date.UTC(2026, 11, 31, 23, 30))).toBe('2027-01')
  })
})
