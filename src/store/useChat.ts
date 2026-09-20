import { create } from 'zustand'
import * as api from '../services/api'
import { generateId } from '../services/pseudonym'
import { useSession } from './useSession'
import type { MatchFilter, Message, Partner, Report, ReportReason, User } from '../services/types'

/**
 * Chat-Ablauf: Suche, aktives Gespräch, Beenden, Melden.
 *
 * Der Verlauf lebt im Arbeitsspeicher und ist für beide Seiten weg, sobald
 * der Chat endet. Beim Beenden wandert er einmal in den Moderationsspeicher,
 * wo er nach 72 Stunden automatisch abläuft – nachlesen kann ihn dort nur
 * die Moderation, und jeder Zugriff wird protokolliert.
 */

const MAX_MESSAGE_LENGTH = 2000

export type ChatStatus = 'idle' | 'suche' | 'aktiv' | 'beendet'
export type EndReason = 'selbst' | 'gemeldet' | 'naechster' | 'blockiert'

interface ChatState {
  status: ChatStatus
  partner: Partner | null
  messages: Message[]
  partnerTyping: boolean
  filter: MatchFilter
  error: string | null
  endReason: EndReason | null
  lastReport: Report | null

  setFilter: (filter: MatchFilter) => void
  startSearch: () => Promise<void>
  cancelSearch: () => void
  sendMessage: (text: string) => void
  endChat: (reason: EndReason) => void
  blockAndEnd: () => Promise<void>
  nextChat: () => Promise<void>
  report: (reason: ReportReason, note: string, reporter: User) => Promise<Report | null>
  clearError: () => void
  dismissEnded: () => void
}

/** Laufzeit-Handles bewusst ausserhalb des States: sie sind kein UI-Zustand. */
let controller: AbortController | null = null
let runToken = 0
let turn = 0
/** Verhindert, dass mehrere Partnerantworten gleichzeitig laufen. */
let partnerTurnActive = false
/** Der Verlauf dieses Chats wird genau einmal gesichert, auch bei Wiederholungen. */
let savedTranscriptId: string | null = null

interface Timer {
  id: number
  resolve: () => void
}

const timers = new Set<Timer>()

/** Bricht laufende Wartezeiten ab und löst ihre Promises auf, damit keine
 *  hängenden Fortsetzungen zurückbleiben. */
function clearTimers() {
  timers.forEach((timer) => {
    window.clearTimeout(timer.id)
    timer.resolve()
  })
  timers.clear()
}

function stopRun() {
  controller?.abort()
  controller = null
  clearTimers()
  partnerTurnActive = false
  runToken += 1
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer: Timer = { id: 0, resolve }
    timer.id = window.setTimeout(() => {
      timers.delete(timer)
      resolve()
    }, ms)
    timers.add(timer)
  })
}

function systemMessage(text: string): Message {
  return { id: generateId('sys'), author: 'system', text, ts: Date.now() }
}

export const useChat = create<ChatState>((set, get) => {
  /**
   * Legt den Verlauf in den Moderationsspeicher, bevor er aus dem
   * Arbeitsspeicher verschwindet. Muss synchron bis zum ersten `await`
   * laufen, solange der Zustand noch steht.
   */
  async function persistTranscript(): Promise<string | null> {
    // Ein fehlgeschlagener Meldeversuch darf keine zweite Kopie desselben
    // Gesprächs anlegen – jede hätte ihre eigene 72-Stunden-Uhr.
    if (savedTranscriptId) return savedTranscriptId
    const { partner, messages } = get()
    const user = useSession.getState().user
    if (!partner || !user) return null
    try {
      const transcript = await api.saveTranscript({ owner: user, partner, messages })
      savedTranscriptId = transcript?.id ?? null
      return savedTranscriptId
    } catch {
      return null
    }
  }

  /** Holt eine Partnerantwort und spielt vorher den Tippindikator ab. */
  async function playPartnerTurn(token: number, first: boolean, ownInterests: string[]) {
    const partner = get().partner
    if (!partner || token !== runToken || partnerTurnActive) return
    partnerTurnActive = true

    try {
      const utterance = first
        ? await api.requestOpener(partner, ownInterests, controller?.signal)
        : await api.requestReply(partner, get().messages, turn, controller?.signal)
      if (token !== runToken) return

      set({ partnerTyping: true })
      await sleep(utterance.typingMs)
      if (token !== runToken) return

      turn += 1
      set((state) => ({
        partnerTyping: false,
        messages: [
          ...state.messages,
          {
            id: generateId('msg'),
            author: 'partner',
            text: utterance.text,
            ts: Date.now(),
            flag: api.scanMessage(utterance.text) ?? undefined,
          },
        ],
      }))
    } catch {
      if (token === runToken) set({ partnerTyping: false })
    } finally {
      if (token === runToken) partnerTurnActive = false
    }
  }

  return {
    status: 'idle',
    partner: null,
    messages: [],
    partnerTyping: false,
    filter: { language: 'egal', interests: [] },
    error: null,
    endReason: null,
    lastReport: null,

    setFilter(filter) {
      set({ filter })
    },

    async startSearch() {
      stopRun()
      controller = new AbortController()
      const token = runToken
      turn = 0
      partnerTurnActive = false
      savedTranscriptId = null

      set({
        status: 'suche',
        partner: null,
        messages: [],
        partnerTyping: false,
        error: null,
        endReason: null,
        lastReport: null,
      })

      try {
        const partner = await api.findMatch(get().filter, controller.signal)
        if (token !== runToken) return

        set({
          status: 'aktiv',
          partner,
          messages: [
            systemMessage(
              `Verbunden mit ${partner.pseudonym}. Beide Seiten sind verifiziert. Der Verlauf wird 72 Stunden für die Missbrauchsprüfung aufbewahrt und danach gelöscht.`,
            ),
          ],
        })

        const ownInterests = get().filter.interests
        void playPartnerTurn(token, true, ownInterests)
      } catch (error) {
        if (token !== runToken) return
        if (error instanceof api.ApiError && error.code === 'abgebrochen') return
        set({
          status: 'idle',
          error:
            error instanceof api.ApiError && error.code === 'kein-treffer'
              ? 'Mit diesen Filtern ist gerade niemand erreichbar. Filter lockern und erneut suchen.'
              : 'Suche fehlgeschlagen. Bitte erneut versuchen.',
        })
      }
    },

    cancelSearch() {
      stopRun()
      set({ status: 'idle', partner: null, partnerTyping: false, error: null })
    },

    sendMessage(text) {
      // Harte Obergrenze auch abseits des Eingabefelds: der Wortfilter läuft
      // über jede Nachricht, und der Verlauf soll nicht beliebig wachsen.
      const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH)
      if (!trimmed || get().status !== 'aktiv') return

      const message: Message = {
        id: generateId('msg'),
        author: 'me',
        text: trimmed,
        ts: Date.now(),
        flag: api.scanMessage(trimmed) ?? undefined,
      }
      set((state) => ({ messages: [...state.messages, message] }))
      void playPartnerTurn(runToken, false, get().filter.interests)
    },

    endChat(reason) {
      // Erst sichern, dann leeren: der Verlauf liegt danach nur noch im
      // Moderationsspeicher und läuft dort nach 72 Stunden ab.
      void persistTranscript()
      stopRun()
      set({ status: 'beendet', endReason: reason, partner: null, messages: [], partnerTyping: false })
    },

    /** Persönliche Blockierung: dieses Konto wird nicht mehr zugelost. */
    async blockAndEnd() {
      const partner = get().partner
      if (!partner) return
      try {
        await api.blockPartner(partner.id)
      } catch {
        // Blockierung nicht gespeichert – der Chat endet trotzdem.
      }
      get().endChat('blockiert')
    },

    async nextChat() {
      get().endChat('naechster')
      await get().startSearch()
    },

    async report(reason, note, reporter) {
      const { partner, messages } = get()
      if (!partner) return null
      try {
        const transcriptId = await persistTranscript()
        const report = await api.submitReport({ reason, note, partner, messages, transcriptId }, reporter)
        stopRun()
        set({
          status: 'beendet',
          endReason: 'gemeldet',
          partner: null,
          messages: [],
          partnerTyping: false,
          lastReport: report,
        })
        return report
      } catch (error) {
        set({
          error:
            error instanceof Error && error.message
              ? error.message
              : 'Meldung konnte nicht gespeichert werden.',
        })
        return null
      }
    },

    clearError() {
      set({ error: null })
    },

    dismissEnded() {
      set({ status: 'idle', endReason: null, lastReport: null, error: null })
    },
  }
})
