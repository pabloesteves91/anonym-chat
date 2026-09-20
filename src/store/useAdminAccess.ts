import { create } from 'zustand'
import { getModeratorAccess, type AccessMode } from '../services/auth'

/** Hält den Zugang zur Moderationsansicht; die Prüfung liegt in services/auth. */
interface AdminAccessState {
  geprueft: boolean
  erlaubt: boolean
  mode: AccessMode
  check: () => Promise<void>
}

export const useAdminAccess = create<AdminAccessState>((set) => ({
  geprueft: false,
  erlaubt: false,
  mode: 'gesperrt',

  async check() {
    const zugang = await getModeratorAccess()
    set({ geprueft: true, erlaubt: zugang.erlaubt, mode: zugang.mode })
  },
}))
