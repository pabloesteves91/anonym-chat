import { create } from 'zustand'
import * as api from '../services/mockApi'
import { generateId } from '../services/pseudonym'
import type { MatchFilter, Message, Partner, Report, ReportReason, User } from '../services/types'

/**
 * Chat-Ablauf: Suche, aktives Gespräch, Beenden, Melden.
 *
 * Der Verlauf lebt ausschliesslich hier im Speicher und wird beim Beenden
 * verworfen – bewusst flüchtig. Nur ein Ausschnitt wandert in eine Meldung,
 * und auch das nur, wenn der Nutzer meldet.
 */

export type ChatStatus = 'idle' | 'suche' | 'aktiv' | 'beendet'
export type EndReason = 'selbst' | 'gemeldet' | 'naechster'

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
  nextChat: () => Promise<void>
  report: (reason: ReportReason, note: string, reporter: User) => Promise<Report | null>
  dismissEnded: () => void
}

/** Laufzeit-Handles bewusst ausserhalb des States: sie sind kein UI-Zustand. */
let controller: AbortController | null = null
let runToken = 0
let turn = 0
const timers = new Set<number>()

function clearTimers() {
  timers.forEach((id) => window.clearTimeout(id))
  timers.clear()
}

function stopRun() {
  controller?.abort()
  controller = null
  clearTimers()
  runToken += 1
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const id = window.setTimeout(() => {
      timers.delete(id)
      resolve()
    }, ms)
    timers.add(id)
  })
}

function systemMessage(text: string): Message {
  return { id: generateId('sys'), author: 'system', text, ts: Date.now() }
}

export const useChat = create<ChatState>((set, get) => {
  /** Holt eine Partnerantwort und spielt vorher den Tippindikator ab. */
  async function playPartnerTurn(token: number, first: boolean, ownInterests: string[]) {
    const partner = get().partner
    if (!partner || token !== runToken) return

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
              `Verbunden mit ${partner.pseudonym}. Beide Seiten sind verifiziert. Der Verlauf wird beim Beenden verworfen.`,
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
      const trimmed = text.trim()
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
      stopRun()
      // Verlauf wird hier tatsächlich verworfen, nicht nur ausgeblendet.
      set({ status: 'beendet', endReason: reason, partner: null, messages: [], partnerTyping: false })
    },

    async nextChat() {
      get().endChat('naechster')
      await get().startSearch()
    },

    async report(reason, note, reporter) {
      const { partner, messages } = get()
      if (!partner) return null
      try {
        const report = await api.submitReport({ reason, note, partner, messages }, reporter)
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
      } catch {
        set({ error: 'Meldung konnte nicht gespeichert werden.' })
        return null
      }
    },

    dismissEnded() {
      set({ status: 'idle', endReason: null, lastReport: null, error: null })
    },
  }
})
