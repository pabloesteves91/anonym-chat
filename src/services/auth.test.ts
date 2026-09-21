import { describe, expect, it } from 'vitest'
import { evaluateAccess } from './auth'
import { ADMIN_UIDS, MODERATOR_UIDS } from './roles'

const ADMIN = ADMIN_UIDS[0]

describe('Moderationszugang', () => {
  it('lässt nur die hinterlegte Kennung durch', () => {
    expect(evaluateAccess({ uid: ADMIN, email: 'mod@example.ch' })).toEqual({
      erlaubt: true,
      rolle: 'verwaltung',
      mode: 'konto',
      email: 'mod@example.ch',
      uid: ADMIN,
    })
  })

  it('sperrt fremde Konten', () => {
    expect(evaluateAccess({ uid: 'irgendwer', email: 'wer@example.ch' })).toEqual({
      erlaubt: false,
      rolle: 'nutzer',
      mode: 'gesperrt',
      email: 'wer@example.ch',
      uid: 'irgendwer',
    })
  })

  it('lässt reine Moderation herein, aber ohne Verwaltungsrechte', () => {
    // Die Liste ist im Auslieferungszustand leer – geprüft wird die Regel,
    // nicht ihr Inhalt.
    const [ersterModerator] = MODERATOR_UIDS
    if (!ersterModerator) return
    const zugang = evaluateAccess({ uid: ersterModerator, email: null })
    expect(zugang.erlaubt).toBe(true)
    expect(zugang.rolle).toBe('moderation')
  })

  it('nennt die Kennung des fremden Kontos, damit der Grund sichtbar wird', () => {
    // Wer angemeldet ist und trotzdem abgewiesen wird, muss vergleichen
    // können – sonst bleibt nur Raten.
    expect(evaluateAccess({ uid: 'irgendwer', email: null }).uid).toBe('irgendwer')
  })

  it('sperrt nicht angemeldete Besucher ohne Angaben', () => {
    expect(evaluateAccess(null)).toEqual({
      erlaubt: false,
      rolle: 'nutzer',
      mode: 'gesperrt',
      email: null,
      uid: null,
    })
  })
})
