import { create } from 'zustand'
import * as api from '../services/api'
import { OFFEN_MAX } from '../services/support'
import type { SupportAnfrage, SupportInput } from '../services/types'

/**
 * Die eigenen Supportanfragen – laufend beobachtet.
 *
 * Früher einmal geladen, jetzt über eine offene Verbindung: Seit es den
 * Supportchat gibt, muss der Menüpunkt erscheinen, sobald die Moderation
 * einen Chat eröffnet, und blinken, sobald sie antwortet – ohne dass jemand
 * neu lädt. Dieselbe Quelle trägt auch die Liste auf der Supportseite, damit
 * es nicht zwei Meinungen über denselben Stand gibt.
 *
 * Die Verbindung hängt am angemeldeten Konto und endet mit ihm.
 */

interface SupportState {
  ready: boolean
  busy: boolean
  error: string | null
  eigene: SupportAnfrage[]
  /** Für welches Konto gerade beobachtet wird – verhindert Doppelanmeldungen. */
  uid: string | null
  stopp: (() => void) | null

  /** Beginnt oder wechselt die Beobachtung; `null` beendet sie. */
  beobachte: (uid: string | null) => void
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
  uid: null,
  stopp: null,

  beobachte(uid) {
    if (get().uid === uid) return
    get().stopp?.()

    if (!uid) {
      set({ uid: null, stopp: null, eigene: [], ready: false })
      return
    }

    const stopp = api.watchEigeneSupport((eigene) => set({ eigene, ready: true }))
    set({ uid, stopp })
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
        error: `Du hast noch ${offen} offene Anfragen. Warte bitte, bis wir dir geantwortet haben.`,
      })
      return null
    }

    set({ busy: true, error: null })
    try {
      // Die Liste aktualisiert sich über die Beobachtung von selbst.
      return await api.submitSupport(eingabe)
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
