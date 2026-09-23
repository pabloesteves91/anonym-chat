import { create } from 'zustand'
import * as api from '../services/api'
import { OFFEN_MAX } from '../services/support'
import type { SupportAnfrage, SupportInput } from '../services/types'

/**
 * Die eigenen Supportanfragen.
 *
 * Getrennt von `useSession`, weil die Supportseite die einzige Stelle ist, die
 * das braucht – der Rest der App soll die Liste nicht bei jedem Seitenaufruf
 * mitladen.
 */

interface SupportState {
  ready: boolean
  busy: boolean
  error: string | null
  eigene: SupportAnfrage[]

  load: () => Promise<void>
  absenden: (eingabe: SupportInput) => Promise<SupportAnfrage | null>
  clearError: () => void
}

const meldung = (error: unknown, fallback: string) =>
  error instanceof api.ApiError ? error.message : fallback

export const useSupport = create<SupportState>((set, get) => ({
  ready: false,
  busy: false,
  error: null,
  eigene: [],

  async load() {
    try {
      const eigene = await api.listEigeneSupport()
      set({ eigene, ready: true, error: null })
    } catch (error) {
      // Auch im Fehlerfall `ready` setzen: Sonst steht dort für immer "wird
      // geladen" und sieht aus wie ein Hänger.
      set({ ready: true, error: meldung(error, 'Deine Anfragen konnten nicht geladen werden.') })
    }
  },

  async absenden(eingabe) {
    // Ein Doppelklick wären sonst zwei gleiche Anfragen in der Liste.
    if (get().busy) return null

    // Bremse gegen Flut. Sie läuft im Browser und ist damit umgehbar – ein
    // Riegel bräuchte eine Serverfunktion. Für den Alltag reicht sie: Wer
    // drei offene Anfragen hat, braucht keine vierte, sondern eine Antwort.
    const offen = get().eigene.filter((a) => a.status !== 'erledigt').length
    if (offen >= OFFEN_MAX) {
      set({
        error: `Du hast ${offen} unerledigte Anfragen. Wir melden uns darauf – bitte warte die Antwort ab.`,
      })
      return null
    }

    set({ busy: true, error: null })
    try {
      const anfrage = await api.submitSupport(eingabe)
      set({ eigene: [anfrage, ...get().eigene] })
      return anfrage
    } catch (error) {
      set({ error: meldung(error, 'Die Anfrage konnte nicht abgeschickt werden.') })
      return null
    } finally {
      set({ busy: false })
    }
  },

  clearError() {
    set({ error: null })
  },
}))
