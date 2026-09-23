import { create } from 'zustand'
import * as api from '../services/api'
import { darfModerieren } from '../services/roles'

/**
 * Was auf Bearbeitung wartet – laufend mitgezählt.
 *
 * Trägt die Zahl am Menüpunkt "Moderation". Die Verbindung läuft nur,
 * solange eine berechtigte Person angemeldet ist: Für alle anderen wäre sie
 * nutzlos und würde von den Regeln ohnehin abgewiesen.
 */

interface OffeneState {
  meldungen: number
  anfragen: number
  /** Läuft gerade eine Verbindung? Verhindert doppelte Anmeldungen. */
  uid: string | null
  stopp: (() => void) | null

  /** Beginnt oder wechselt die Beobachtung; `null` beendet sie. */
  beobachte: (uid: string | null) => void
}

export const useOffene = create<OffeneState>((set, get) => ({
  meldungen: 0,
  anfragen: 0,
  uid: null,
  stopp: null,

  beobachte(uid) {
    if (get().uid === uid) return

    get().stopp?.()

    if (!uid || !darfModerieren(uid)) {
      set({ uid: null, stopp: null, meldungen: 0, anfragen: 0 })
      return
    }

    const stopp = api.watchOffeneVorgaenge(({ meldungen, anfragen }) => set({ meldungen, anfragen }))
    set({ uid, stopp })
  },
}))

/** Die Zahl am Abzeichen: alles, was noch niemand angefasst hat. */
export const summeOffen = (s: OffeneState) => s.meldungen + s.anfragen
