import { create } from 'zustand'
import {
  AuthError,
  signInModerator,
  signInWithProvider,
  signOutModerator,
  watchModeratorAccess,
  type AccessMode,
  type OAuthAnbieter,
} from '../services/auth'

/**
 * Zugang zur Moderationsansicht. Die Entscheidung fällt in services/auth,
 * hier wird sie nur gehalten und an die Oberfläche gereicht.
 */
interface AdminAccessState {
  geprueft: boolean
  erlaubt: boolean
  mode: AccessMode
  email: string | null
  busy: boolean
  error: string | null

  /** Einmal abonnieren; meldet auch spätere Ab- und Anmeldungen. */
  watch: () => () => void
  signIn: (email: string, password: string) => Promise<void>
  signInWith: (anbieter: OAuthAnbieter) => Promise<void>
  signOut: () => Promise<void>
}

export const useAdminAccess = create<AdminAccessState>((set) => ({
  geprueft: false,
  erlaubt: false,
  mode: 'gesperrt',
  email: null,
  busy: false,
  error: null,

  watch() {
    return watchModeratorAccess((access) =>
      set({ geprueft: true, erlaubt: access.erlaubt, mode: access.mode, email: access.email }),
    )
  },

  async signIn(email, password) {
    set({ busy: true, error: null })
    try {
      const access = await signInModerator(email, password)
      // Den Rest meldet der Beobachter; hier nur den Ladezustand schliessen.
      set({ busy: false, erlaubt: access.erlaubt, mode: access.mode, email: access.email })
    } catch (error) {
      set({ busy: false, error: error instanceof AuthError ? error.message : 'Anmeldung fehlgeschlagen.' })
    }
  },

  async signInWith(anbieter) {
    set({ busy: true, error: null })
    try {
      const access = await signInWithProvider(anbieter)
      set({ busy: false, erlaubt: access.erlaubt, mode: access.mode, email: access.email })
    } catch (error) {
      set({ busy: false, error: error instanceof AuthError ? error.message : 'Anmeldung fehlgeschlagen.' })
    }
  },

  async signOut() {
    set({ busy: true })
    await signOutModerator()
    set({ busy: false, erlaubt: false, mode: 'gesperrt', email: null, error: null })
  },
}))
