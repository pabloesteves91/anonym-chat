import { create } from 'zustand'
import * as api from '../services/api'
import type { PlanId } from '../services/plans'
import type { Geschlecht, Profile, User } from '../services/types'

/**
 * Identität und Verifizierungsstatus.
 *
 * Der Store ist die einzige Stelle, an der die UI mit `mockApi` spricht –
 * Komponenten rufen nur noch Aktionen dieses Stores auf.
 */

interface SessionState {
  ready: boolean
  /** Läuft gerade ein Laden für ein Konto? Dann noch nichts entscheiden. */
  loading: boolean
  user: User | null
  storageAvailable: boolean
  codexAccepted: boolean
  selfBlocked: string[]
  error: string | null
  busy: boolean

  load: (uid: string) => Promise<void>
  clear: () => void
  clearError: () => void
  /** Nur Nutzer und Status neu lesen, ohne Ladezustand zurückzusetzen. */
  refreshUser: () => Promise<void>
  acceptCodex: () => Promise<void>
  /** Tarif auswählen: gratis gilt sofort, bezahlt wird ein Wunsch daraus. */
  choosePlan: (plan: PlanId) => Promise<boolean>
  /** Einmalige Angabe bei der Registrierung; setzt zugleich den Namen. */
  setGeschlecht: (geschlecht: Geschlecht) => Promise<boolean>
  refreshBlocks: () => Promise<void>
  unblockAll: () => Promise<void>
  saveProfile: (profile: Profile) => Promise<void>
  newPseudonym: () => Promise<void>
  renamePseudonym: (name: string) => Promise<boolean>
  resetIdentity: () => Promise<void>
}

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  loading: false,
  user: null,
  storageAvailable: true,
  codexAccepted: false,
  selfBlocked: [],
  error: null,
  busy: false,

  async load(uid) {
    // Bis das Profil dieses Kontos geladen ist, darf keine Weiche gestellt
    // werden – sonst landet eine verifizierte Person wieder im Antrag.
    set({ loading: true, error: null })
    try {
      await api.ensureIdentity(uid)
      const session = await api.getSession()
      set({
        ready: true,
        user: session.user,
        storageAvailable: session.storageAvailable,
        codexAccepted: session.codexAccepted,
        selfBlocked: session.selfBlocked,
        loading: false,
      })
    } catch (error) {
      // Ein Fehlschlag muss enden. Bleibt `loading` stehen, wartet die
      // Oberfläche bis in alle Ewigkeit auf ein Profil, das nie kommt –
      // von aussen nicht von "lädt gerade" zu unterscheiden.
      set({
        ready: true,
        loading: false,
        user: null,
        error: error instanceof api.ApiError ? error.message : 'Dein Profil konnte nicht geladen werden.',
      })
    }
  },

  clear() {
    set({ ready: true, loading: false, user: null, codexAccepted: false, selfBlocked: [], error: null })
  },

  clearError() {
    set({ error: null })
  },

  async refreshUser() {
    const session = await api.getSession()
    set({ user: session.user, storageAvailable: session.storageAvailable })
  },

  async acceptCodex() {
    await api.acceptCodex()
    set({ codexAccepted: true })
  },

  async setGeschlecht(geschlecht) {
    set({ busy: true, error: null })
    try {
      const user = await api.setGeschlecht(geschlecht)
      set({ user, busy: false })
      return true
    } catch (error) {
      set({
        busy: false,
        error: error instanceof api.ApiError ? error.message : 'Die Angabe wurde nicht gespeichert.',
      })
      return false
    }
  },

  async choosePlan(plan) {
    set({ busy: true, error: null })
    try {
      await api.choosePlan(plan)
      await get().refreshUser()
      set({ busy: false })
      return true
    } catch (error) {
      set({ busy: false, error: error instanceof api.ApiError ? error.message : 'Auswahl nicht gespeichert.' })
      return false
    }
  },

  async refreshBlocks() {
    set({ selfBlocked: await api.listSelfBlocked() })
  },

  async unblockAll() {
    set({ busy: true })
    await api.clearSelfBlocked()
    set({ selfBlocked: [], busy: false })
  },


  async saveProfile(profile) {
    set({ busy: true })
    try {
      const user = await api.updateProfile(profile)
      set({ user, busy: false, error: null })
    } catch {
      set({ busy: false, error: 'Profil konnte nicht gespeichert werden.' })
    }
  },

  async renamePseudonym(name) {
    set({ busy: true, error: null })
    try {
      const user = await api.setPseudonym(name)
      set({ user, busy: false })
      return true
    } catch (error) {
      set({ busy: false, error: error instanceof api.ApiError ? error.message : 'Name konnte nicht gespeichert werden.' })
      return false
    }
  },

  async newPseudonym() {
    set({ busy: true })
    try {
      const user = await api.regeneratePseudonym()
      set({ user, busy: false })
    } catch {
      set({ busy: false })
    }
  },

  async resetIdentity() {
    await api.resetIdentity()
    set({ user: null, error: null, codexAccepted: false, selfBlocked: [] })
  },
}))
