import { create } from 'zustand'
import * as api from '../services/api'
import { AKTION_STANDARD, setzeAktuelleAktion, type Aktion } from '../services/aktion'

/**
 * Die Release-Aktion, live aus Firestore.
 *
 * Einmal in der AppShell gestartet. Neben dem Store wird auch der
 * Modulstand in services/aktion.ts nachgeführt – den lesen die Tarifgrenzen.
 */
interface AktionState {
  aktion: Aktion
  bereit: boolean
  beobachte: () => () => void
}

export const useAktion = create<AktionState>((set) => ({
  aktion: AKTION_STANDARD,
  bereit: false,
  beobachte() {
    return api.watchAktion((aktion) => {
      setzeAktuelleAktion(aktion)
      set({ aktion, bereit: true })
    })
  },
}))
