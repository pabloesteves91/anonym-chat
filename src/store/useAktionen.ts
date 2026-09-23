import { create } from 'zustand'
import * as api from '../services/api'
import {
  aktionsStand,
  besterRabatt,
  gratisBis,
  normiereCode,
  setzeAktuelleAktionen,
  type Aktion,
  type Rabatt,
} from '../services/aktion'
import type { PlanId } from '../services/plans'

/**
 * Aktionen, live aus Firestore – dazu ein eingelöster Gutschein.
 *
 * Einmal in der AppShell gestartet. Neben dem Store wird auch der
 * Modulstand in services/aktion.ts nachgeführt – den lesen die Tarifgrenzen.
 *
 * Der Gutschein lebt nur in dieser Sitzung (und im Link `?code=…`), nicht
 * im Konto: Er ist ein Preis, keine Eigenschaft der Person.
 */
interface AktionenState {
  aktionen: Aktion[]
  bereit: boolean
  gutschein: Aktion | null
  gutscheinFehler: string | null
  gutscheinPrueft: boolean
  beobachte: () => () => void
  einloesen: (eingabe: string) => Promise<boolean>
  entfernen: () => void
}

export const useAktionen = create<AktionenState>((set) => ({
  aktionen: [],
  bereit: false,
  gutschein: null,
  gutscheinFehler: null,
  gutscheinPrueft: false,

  beobachte() {
    return api.watchAktionen((aktionen) => {
      setzeAktuelleAktionen(aktionen)
      set({ aktionen, bereit: true })
    })
  },

  async einloesen(eingabe) {
    const code = normiereCode(eingabe)
    if (!code) return false
    set({ gutscheinPrueft: true, gutscheinFehler: null })
    try {
      const aktion = await api.ladeGutschein(code)
      const stand = aktionsStand(aktion)
      if (!aktion || !stand.rabatt) {
        set({
          gutschein: null,
          gutscheinFehler: aktion && stand.startetAm ? 'Dieser Code gilt noch nicht.' : 'Diesen Code gibt es nicht, oder er ist abgelaufen.',
        })
        return false
      }
      set({ gutschein: aktion })
      return true
    } catch (error) {
      set({ gutschein: null, gutscheinFehler: error instanceof api.ApiError ? error.message : 'Der Code konnte nicht geprüft werden.' })
      return false
    } finally {
      set({ gutscheinPrueft: false })
    }
  },

  entfernen() {
    set({ gutschein: null, gutscheinFehler: null })
  },
}))

/** Alle Aktionen, die für diese Person gelten: öffentliche plus eingelöster Gutschein. */
const gueltige = (s: Pick<AktionenState, 'aktionen' | 'gutschein'>) => (s.gutschein ? [...s.aktionen, s.gutschein] : s.aktionen)

/** Der beste Rabatt für einen Tarif – der höchste gewinnt, nichts wird addiert. */
export function rabattFuer(s: Pick<AktionenState, 'aktionen' | 'gutschein'>, plan: PlanId, jetzt = Date.now()): Rabatt | null {
  return besterRabatt(gueltige(s), plan, jetzt)
}

export function gratisZeitBis(s: Pick<AktionenState, 'aktionen'>, jetzt = Date.now()): Date | null {
  return gratisBis(s.aktionen, jetzt)
}
