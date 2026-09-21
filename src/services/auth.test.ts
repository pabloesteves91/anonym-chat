import { describe, expect, it } from 'vitest'
import { evaluateAccess } from './auth'
import { MODERATOR_UID } from './firebase'

describe('Moderationszugang', () => {
  it('lässt nur die hinterlegte Kennung durch', () => {
    expect(evaluateAccess({ uid: MODERATOR_UID, email: 'mod@example.ch' })).toEqual({
      erlaubt: true,
      mode: 'konto',
      email: 'mod@example.ch',
      uid: MODERATOR_UID,
    })
  })

  it('sperrt fremde Konten', () => {
    expect(evaluateAccess({ uid: 'irgendwer', email: 'wer@example.ch' })).toEqual({
      erlaubt: false,
      mode: 'gesperrt',
      email: 'wer@example.ch',
      uid: 'irgendwer',
    })
  })

  it('nennt die Kennung des fremden Kontos, damit der Grund sichtbar wird', () => {
    // Wer angemeldet ist und trotzdem abgewiesen wird, muss vergleichen
    // können – sonst bleibt nur Raten.
    expect(evaluateAccess({ uid: 'irgendwer', email: null }).uid).toBe('irgendwer')
  })

  it('sperrt nicht angemeldete Besucher ohne Angaben', () => {
    expect(evaluateAccess(null)).toEqual({ erlaubt: false, mode: 'gesperrt', email: null, uid: null })
  })
})
