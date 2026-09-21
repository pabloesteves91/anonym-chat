import { create } from 'zustand'
import {
  AuthError,
  completeUserRedirect,
  registerUserWithPassword,
  sendPasswordReset,
  signInUser,
  signInUserWithPassword,
  signOutUser,
  watchUser,
  type AppUser,
  type OAuthAnbieter,
} from '../services/auth'
import { setAccount } from '../services/storage'

/**
 * Das angemeldete Konto.
 *
 * Es ist die Klammer um alles Persönliche: Pseudonym, Profil,
 * Verifizierungsstand und eigene Blockierungen hängen daran. Wechselt das
 * Konto, wechselt auch der Speicherbereich – zwei Anmeldungen im selben
 * Browser teilen sich nichts.
 */
interface AuthState {
  ready: boolean
  user: AppUser | null
  busy: boolean
  error: string | null

  watch: (onAccountChange: (uid: string | null) => void) => () => void
  signIn: (anbieter: OAuthAnbieter) => Promise<void>
  signInWithPassword: (email: string, passwort: string) => Promise<void>
  register: (email: string, passwort: string) => Promise<void>
  resetPassword: (email: string) => Promise<boolean>
  signOut: () => Promise<void>
  clearError: () => void
}

export const useAuth = create<AuthState>((set) => ({
  ready: false,
  user: null,
  busy: false,
  error: null,

  watch(onAccountChange) {
    void completeUserRedirect().catch((error) =>
      set({ error: error instanceof AuthError ? error.message : 'Anmeldung fehlgeschlagen.' }),
    )

    return watchUser((user) => {
      // Erst den Speicherbereich umstellen, dann die Oberfläche informieren –
      // sonst liest der nächste Zugriff noch die Daten des alten Kontos.
      setAccount(user?.uid ?? null)
      set({ ready: true, user, busy: false })
      onAccountChange(user?.uid ?? null)
    })
  },

  async signIn(anbieter) {
    set({ busy: true, error: null })
    try {
      await signInUser(anbieter)
      // Der Beobachter übernimmt ab hier.
    } catch (error) {
      set({ busy: false, error: error instanceof AuthError ? error.message : 'Anmeldung fehlgeschlagen.' })
    }
  },

  async signInWithPassword(email, passwort) {
    set({ busy: true, error: null })
    try {
      await signInUserWithPassword(email, passwort)
      // Der Beobachter übernimmt ab hier.
    } catch (error) {
      set({ busy: false, error: error instanceof AuthError ? error.message : 'Anmeldung fehlgeschlagen.' })
    }
  },

  async register(email, passwort) {
    set({ busy: true, error: null })
    try {
      await registerUserWithPassword(email, passwort)
    } catch (error) {
      set({ busy: false, error: error instanceof AuthError ? error.message : 'Konto konnte nicht angelegt werden.' })
    }
  },

  async resetPassword(email) {
    set({ busy: true, error: null })
    try {
      await sendPasswordReset(email)
      set({ busy: false })
      return true
    } catch (error) {
      set({ busy: false, error: error instanceof AuthError ? error.message : 'Die E-Mail konnte nicht raus.' })
      return false
    }
  },

  async signOut() {
    set({ busy: true })
    await signOutUser()
    setAccount(null)
    set({ busy: false, user: null, error: null })
  },

  clearError() {
    set({ error: null })
  },
}))
