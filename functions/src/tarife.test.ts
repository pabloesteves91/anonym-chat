import { describe, expect, it } from 'vitest'
import { TESTZAHLER, darfBezahlen, istTestschluessel } from './tarife'

describe('Testbetrieb der Kasse', () => {
  it('erkennt den Testschlüssel', () => {
    expect(istTestschluessel('sk_test_abc')).toBe(true)
    expect(istTestschluessel('sk_live_abc')).toBe(false)
  })

  it('lässt im Testbetrieb nur die Verwaltung bezahlen', () => {
    expect(darfBezahlen('sk_test_abc', TESTZAHLER[0])).toBe(true)
    expect(darfBezahlen('sk_test_abc', 'irgendwer')).toBe(false)
  })

  it('im Livebetrieb alle', () => {
    expect(darfBezahlen('sk_live_abc', 'irgendwer')).toBe(true)
  })
})
