import { describe, expect, it } from 'vitest'
import { GRATIS_CHATS_PRO_TAG, aktiverPlan, grenzen, heute, preisText, verbleibend, PLAENE } from './plans'
import type { Membership } from './plans'

const mitgliedschaft = (patch: Partial<Membership> = {}): Membership => ({
  plan: 'plus-monat',
  seit: '2026-01-01T00:00:00.000Z',
  bis: null,
  ...patch,
})

describe('aktiverPlan', () => {
  it('ist ohne Eintrag gratis', () => {
    expect(aktiverPlan(null)).toBe('frei')
  })

  it('fällt nach Ablauf auf gratis zurück', () => {
    const abgelaufen = mitgliedschaft({ bis: '2026-02-01T00:00:00.000Z' })
    expect(aktiverPlan(abgelaufen, Date.parse('2026-01-15T00:00:00.000Z'))).toBe('plus-monat')
    expect(aktiverPlan(abgelaufen, Date.parse('2026-02-02T00:00:00.000Z'))).toBe('frei')
  })

  it('lässt Lifetime nie ablaufen', () => {
    const lifetime = mitgliedschaft({ plan: 'lifetime', bis: null })
    expect(aktiverPlan(lifetime, Date.parse('2099-01-01T00:00:00.000Z'))).toBe('lifetime')
  })
})

describe('grenzen', () => {
  it('begrenzt den Gratistarif und lässt ihn nicht filtern', () => {
    const g = grenzen(null)
    expect(g.chatsProTag).toBe(GRATIS_CHATS_PRO_TAG)
    expect(g.interessenFilter).toBe(false)
    expect(g.eigenerName).toBe(false)
  })

  it('hebt mit Plus alles auf', () => {
    const g = grenzen(mitgliedschaft())
    expect(g.chatsProTag).toBeNull()
    expect(g.interessenFilter).toBe(true)
    expect(g.bevorzugt).toBe(true)
  })
})

describe('verbleibend', () => {
  const jetzt = new Date('2026-03-05T10:00:00')

  it('zählt nur den heutigen Tag', () => {
    expect(verbleibend(null, { tag: heute(jetzt), chats: 3 }, jetzt)).toBe(GRATIS_CHATS_PRO_TAG - 3)
    expect(verbleibend(null, { tag: '2026-03-04', chats: 99 }, jetzt)).toBe(GRATIS_CHATS_PRO_TAG)
  })

  it('geht nicht unter null', () => {
    expect(verbleibend(null, { tag: heute(jetzt), chats: 999 }, jetzt)).toBe(0)
  })

  it('meldet für Plus keine Grenze', () => {
    expect(verbleibend(mitgliedschaft(), { tag: heute(jetzt), chats: 999 }, jetzt)).toBeNull()
  })
})

describe('preisText', () => {
  it('schreibt ganze Franken mit Strich', () => {
    expect(preisText(PLAENE.find((p) => p.id === 'plus-jahr')!)).toBe('CHF 69.–')
  })

  it('schreibt Rappen aus', () => {
    expect(preisText(PLAENE.find((p) => p.id === 'plus-monat')!)).toBe('CHF 7.90')
  })
})
