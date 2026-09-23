import { describe, expect, it } from 'vitest'
import { toUser } from './firestore'

/**
 * Regression: Eine Supportanfrage liess sich nicht abschicken.
 *
 * Ursache war ein Konto, dem nach einer Bearbeitung in der Firebase-Konsole
 * `membership` fehlte. Die Anzeige verriet nichts davon – sie las über
 * `toUser` und bekam den Standardwert. Geschrieben wurde aber aus dem rohen
 * Dokument, dort stand `undefined`, und Firestore weist jedes Dokument mit
 * `undefined` ab. Die Meldung im Browser lautete nur "konnte nicht
 * abgeschickt werden", weil dieser Fehler keinen übersetzbaren Code trägt.
 *
 * Deshalb wird hier jedes Feld einzeln geprüft: Was hier durchfällt, fällt im
 * Betrieb erst auf, wenn jemand etwas abschicken will.
 */
describe('toUser', () => {
  const KENNUNG = 'konto-abcdef123456'

  it('füllt ein vollständig leeres Dokument auf', () => {
    const user = toUser(KENNUNG, {})
    for (const [feld, wert] of Object.entries(user)) {
      expect(wert, `Feld ${feld} ist undefined – Firestore würde das Schreiben abweisen`).not.toBeUndefined()
    }
  })

  it('setzt einen Namen, auch wenn keiner im Dokument steht', () => {
    expect(toUser(KENNUNG, {}).pseudonym).toBe('Konto konto-')
    expect(toUser(KENNUNG, { pseudonym: '' }).pseudonym).toBe('Konto konto-')
    expect(toUser(KENNUNG, { pseudonym: 'Stille Amsel 2098' }).pseudonym).toBe('Stille Amsel 2098')
  })

  it('gibt dem Tarif einen Standardwert – das war der Fehler', () => {
    const ohne = toUser(KENNUNG, { pseudonym: 'Pablo' })
    expect(ohne.membership).toBeDefined()
    expect(ohne.membership.plan).toBe('frei')
  })

  it('behandelt ein Konto ohne Prüfstand als ungeprüft', () => {
    const user = toUser(KENNUNG, {})
    expect(user.verificationStatus).toBe('offen')
    expect(user.verified).toBe(false)
  })

  it('lässt gesetzte Werte unangetastet', () => {
    const user = toUser(KENNUNG, {
      pseudonym: 'Blauer Falke 4417',
      verificationStatus: 'verifiziert',
      geschlecht: 'maennlich',
      membership: { plan: 'lifetime', seit: '2026-01-01T00:00:00.000Z', bis: null },
    })
    expect(user.pseudonym).toBe('Blauer Falke 4417')
    expect(user.verified).toBe(true)
    expect(user.geschlecht).toBe('maennlich')
    expect(user.membership.plan).toBe('lifetime')
  })

  it('ergänzt ein halbes Profil, statt es zu ersetzen', () => {
    const user = toUser(KENNUNG, { profile: { language: 'fr' } as never })
    expect(user.profile.language).toBe('fr')
    expect(user.profile.ageGroup).toBeDefined()
    expect(user.profile.interests).toEqual([])
  })
})
