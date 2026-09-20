import { create } from 'zustand'
import * as api from '../services/api'
import type { Profile, User } from '../services/types'

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
  /** Nur Nutzer und Status neu lesen, ohne Ladezustand zurückzusetzen. */
  refreshUser: () => Promise<void>
  acceptCodex: () => Promise<void>
  refreshBlocks: () => Promise<void>
  unblockAll: () => Promise<void>
  saveProfile: (profile: Profile) => Promise<void>
  newPseudonym: () => Promise<void>
  renamePseudonym: (name: string) => Promise<boolean>
  resetIdentity: () => Promise<void>
}

export const useSession = create<SessionState>((set) => ({
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
    set({ loading: true })
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
  },

  clear() {
    set({ ready: true, loading: false, user: null, codexAccepted: false, selfBlocked: [], error: null })
  },

  async refreshUser() {
    const session = await api.getSession()
    set({ user: session.user, storageAvailable: session.storageAvailable })
  },

  async acceptCodex() {
    await api.acceptCodex()
    set({ codexAccepted: true })
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
