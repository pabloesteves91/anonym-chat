import { describe, expect, it } from 'vitest'
import { TARIFE, TESTZAHLER, darfBezahlen, istEingerichtet, istTestschluessel, preisFuer } from './tarife'

describe('Testbetrieb der Kasse', () => {
  it('erkennt den Testschlüssel', () => {
    expect(istTestschluessel('sk_test_abc')).toBe(true)
    expect(istTestschluessel('rk_test_abc')).toBe(true)
    expect(istTestschluessel('sk_live_abc')).toBe(false)
    expect(istTestschluessel('rk_live_abc')).toBe(false)
  })

  it('lässt im Testbetrieb nur die Verwaltung bezahlen', () => {
    expect(darfBezahlen('sk_test_abc', TESTZAHLER[0])).toBe(true)
    expect(darfBezahlen('sk_test_abc', 'irgendwer')).toBe(false)
  })

  it('im Livebetrieb alle', () => {
    expect(darfBezahlen('sk_live_abc', 'irgendwer')).toBe(true)
  })
})

describe('Preise je Umgebung', () => {
  it('nimmt mit dem Testschlüssel die Sandbox-Preise, sonst die Live-Preise', () => {
    expect(preisFuer('plus-monat', 'sk_test_x')).toBe(TARIFE['plus-monat'].preis.test)
    expect(preisFuer('plus-monat', 'sk_live_x')).toBe(TARIFE['plus-monat'].preis.live)
  })

  it('hat für jeden Tarif in beiden Umgebungen einen eigenen Preis', () => {
    for (const plan of ['plus-monat', 'plus-jahr', 'lifetime'] as const) {
      expect(istEingerichtet(plan, 'sk_test_x')).toBe(true)
      expect(istEingerichtet(plan, 'sk_live_x')).toBe(true)
      expect(TARIFE[plan].preis.test).not.toBe(TARIFE[plan].preis.live)
    }
  })
})
