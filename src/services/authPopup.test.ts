import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression: Auf dem iPhone blieb die Anmeldung mit Google und Apple auf
 * einer leeren Seite hängen („Pop-ups blockiert").
 *
 * Vor dem Anmeldefenster stand ein `await setPersistence(...)`. Safari öffnet
 * ein Fenster aber nur direkt aus dem Tipp heraus; nach einem `await` ist es
 * zu spät. Der Rückfall auf die Weiterleitung scheiterte dann an der
 * getrennten Speicherung zwischen github.io und firebaseapp.com.
 */

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  OAuthProvider: class {
    addScope() {}
  },
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  onAuthStateChanged: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./firebase', () => ({ APP_DOMAIN: 'none-chat.ch', getFirebaseAuth: () => ({ name: 'auth' }) }))

const firebaseAuth = await import('firebase/auth')
const { AuthError, signInUser, weiterleitenBei } = await import('./auth')

const fehler = (code: string) => Object.assign(new Error(code), { code })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Anmeldung mit Google und Apple', () => {
  it('öffnet das Fenster sofort, ohne etwas davor abzuwarten', () => {
    vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue({ user: { uid: 'u', email: null, providerData: [] } } as never)
    // Kein await: Das Fenster muss schon im selben Takt wie der Tipp aufgehen.
    void signInUser('google')
    expect(firebaseAuth.signInWithPopup).toHaveBeenCalledTimes(1)
    void signInUser('apple')
    expect(firebaseAuth.signInWithPopup).toHaveBeenCalledTimes(2)
  })

  it('leitet bei blockiertem Fenster nicht weiter, sondern sagt, was zu tun ist', async () => {
    vi.mocked(firebaseAuth.signInWithPopup).mockRejectedValue(fehler('auth/popup-blocked'))
    const ergebnis = signInUser('google')
    await expect(ergebnis).rejects.toBeInstanceOf(AuthError)
    await expect(ergebnis).rejects.toThrow(/erlaube Pop-ups/)
    expect(firebaseAuth.signInWithRedirect).not.toHaveBeenCalled()
  })

  it('leitet nur dort weiter, wo es gar keine Fenster gibt', async () => {
    vi.mocked(firebaseAuth.signInWithPopup).mockRejectedValue(
      fehler('auth/operation-not-supported-in-this-environment'),
    )
    void signInUser('apple')
    await vi.waitFor(() => expect(firebaseAuth.signInWithRedirect).toHaveBeenCalledTimes(1))
  })
})

describe('Weiterleitung nur, wo sie ankommt', () => {
  it('auf der eigenen Domain darf ein blockiertes Fenster weiterleiten', () => {
    expect(weiterleitenBei('auth/popup-blocked', 'none-chat.ch')).toBe(true)
  })

  it('auf fremden Adressen nicht – dort bliebe eine leere Seite', () => {
    expect(weiterleitenBei('auth/popup-blocked', 'anonym-chat-223af.web.app')).toBe(false)
    expect(weiterleitenBei('auth/popup-blocked', 'pabloesteves91.github.io')).toBe(false)
  })

  it('ohne Fenster immer, andere Fehler nie', () => {
    expect(weiterleitenBei('auth/operation-not-supported-in-this-environment', 'irgendwo.ch')).toBe(true)
    expect(weiterleitenBei('auth/popup-closed-by-user', 'none-chat.ch')).toBe(false)
  })
})
