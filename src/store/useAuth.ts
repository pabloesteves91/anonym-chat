import { create } from 'zustand'
import {
  AuthError,
  completeUserRedirect,
  signInTestAccount,
  signInUser,
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
  signInTest: (email?: string) => Promise<void>
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

  async signInTest(email) {
    set({ busy: true, error: null })
    try {
      await signInTestAccount(email)
    } catch (error) {
      set({ busy: false, error: error instanceof AuthError ? error.message : 'Testanmeldung fehlgeschlagen.' })
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
