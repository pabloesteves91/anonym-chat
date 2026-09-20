import { describe, expect, it } from 'vitest'
import { evaluateAccess } from './auth'
import { MODERATOR_UID } from './firebase'

describe('Moderationszugang', () => {
  it('lässt nur die hinterlegte Kennung durch', () => {
    expect(evaluateAccess({ uid: MODERATOR_UID, email: 'mod@example.ch' })).toEqual({
      erlaubt: true,
      mode: 'konto',
      email: 'mod@example.ch',
    })
  })

  it('sperrt fremde Konten und nicht angemeldete Besucher', () => {
    const gesperrt = { erlaubt: false, mode: 'gesperrt', email: null }
    expect(evaluateAccess({ uid: 'irgendwer', email: 'wer@example.ch' })).toEqual(gesperrt)
    expect(evaluateAccess(null)).toEqual(gesperrt)
  })
})
