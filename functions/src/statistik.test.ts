import { describe, expect, it } from 'vitest'
import { DAUER_MAX_MS, GEZAEHLT_MAX, LEERE_STATISTIK, monatVon, statistikAus, zaehleGespraech } from './statistik'

const SEPT = Date.UTC(2026, 8, 15, 12)

describe('Statistik', () => {
  it('zählt ein Gespräch höchstens einmal', () => {
    const g = { chatId: 'chat1', dauerMs: 60_000, endeMs: SEPT }
    const einmal = zaehleGespraech(LEERE_STATISTIK, g)
    const zweimal = zaehleGespraech(einmal.stand, g)
    expect(einmal.neu).toBe(true)
    expect(zweimal.neu).toBe(false)
    expect(zweimal.stand.gespraeche).toBe(1)
    expect(zweimal.stand.dauerSummeMs).toBe(60_000)
    expect(zweimal.stand.monate).toEqual({ '2026-09': 1 })
  })

  it('führt Summe, Längstes und Monate', () => {
    let stand = LEERE_STATISTIK
    stand = zaehleGespraech(stand, { chatId: 'a', dauerMs: 120_000, endeMs: SEPT }).stand
    stand = zaehleGespraech(stand, { chatId: 'b', dauerMs: 30_000, endeMs: Date.UTC(2026, 9, 1, 12) }).stand
    expect(stand.gespraeche).toBe(2)
    expect(stand.dauerSummeMs).toBe(150_000)
    expect(stand.laengsteMs).toBe(120_000)
    expect(stand.monate).toEqual({ '2026-09': 1, '2026-10': 1 })
  })

  it('begrenzt unplausible Dauern', () => {
    expect(zaehleGespraech(LEERE_STATISTIK, { chatId: 'a', dauerMs: -5, endeMs: SEPT }).stand.dauerSummeMs).toBe(0)
    expect(zaehleGespraech(LEERE_STATISTIK, { chatId: 'a', dauerMs: 1e12, endeMs: SEPT }).stand.laengsteMs).toBe(DAUER_MAX_MS)
  })

  it('rechnet den Monat in Zürcher Zeit', () => {
    // 31.12. 23:30 UTC ist in Zürich schon Januar.
    expect(monatVon(Date.UTC(2026, 11, 31, 23, 30))).toBe('2027-01')
  })

  it('merkt sich nur die jüngsten Räume', () => {
    let stand = LEERE_STATISTIK
    for (let i = 0; i < GEZAEHLT_MAX + 5; i++) {
      stand = zaehleGespraech(stand, { chatId: `c${i}`, dauerMs: 1, endeMs: SEPT }).stand
    }
    expect(stand.gezaehlt).toHaveLength(GEZAEHLT_MAX)
    expect(stand.gespraeche).toBe(GEZAEHLT_MAX + 5)
  })

  it('liest fremde Felder nicht mit', () => {
    expect(statistikAus({ gut: 4, gespraeche: 2, monate: { kaputt: 3, '2026-09': 2 } })).toEqual({
      ...LEERE_STATISTIK,
      gespraeche: 2,
      monate: { '2026-09': 2 },
    })
  })
})
