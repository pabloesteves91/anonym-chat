import { create } from 'zustand'
import * as api from '../services/mockApi'
import type { Profile, User, VerificationStage } from '../services/types'

/**
 * Identität und Verifizierungsstatus.
 *
 * Der Store ist die einzige Stelle, an der die UI mit `mockApi` spricht –
 * Komponenten rufen nur noch Aktionen dieses Stores auf.
 */

interface SessionState {
  ready: boolean
  user: User | null
  storageAvailable: boolean
  codexAccepted: boolean
  selfBlocked: string[]
  stage: VerificationStage
  error: string | null
  busy: boolean

  load: () => Promise<void>
  acceptCodex: () => Promise<void>
  refreshBlocks: () => Promise<void>
  unblockAll: () => Promise<void>
  verify: (file: File | null) => Promise<boolean>
  resetVerification: () => void
  saveProfile: (profile: Profile) => Promise<void>
  newPseudonym: () => Promise<void>
  resetIdentity: () => Promise<void>
}

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  user: null,
  storageAvailable: true,
  codexAccepted: false,
  selfBlocked: [],
  stage: 'idle',
  error: null,
  busy: false,

  async load() {
    const session = await api.getSession()
    set({
      ready: true,
      user: session.user,
      storageAvailable: session.storageAvailable,
      codexAccepted: session.codexAccepted,
      selfBlocked: session.selfBlocked,
      stage: session.user?.verified ? 'fertig' : 'idle',
    })
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

  async verify(file) {
    set({ error: null, busy: true, stage: 'dokument' })
    try {
      await api.submitDocument(file)
      await api.runLivenessCheck((stage) => set({ stage }))
      const user = await api.completeVerification()
      set({ user, stage: 'fertig', busy: false })
      return true
    } catch (error) {
      const message = error instanceof api.ApiError ? error.message : 'Verifizierung fehlgeschlagen.'
      set({ error: message, stage: 'idle', busy: false })
      return false
    }
  },

  resetVerification() {
    set({ stage: get().user?.verified ? 'fertig' : 'idle', error: null })
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
    set({ user: null, stage: 'idle', error: null, codexAccepted: false, selfBlocked: [] })
  },
}))
