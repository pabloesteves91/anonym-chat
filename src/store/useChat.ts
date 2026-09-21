import { create } from 'zustand'
import * as api from '../services/api'
import { generateId } from '../services/pseudonym'
import { grenzenFuer, verbleibend } from '../services/plans'
import { useSession } from './useSession'
import type { LiveMessage } from '../services/api'
import type { MatchFilter, Message, Partner, Report, ReportReason, User } from '../services/types'

/**
 * Chat-Ablauf: Suche, laufendes Gespräch, Beenden, Melden.
 *
 * Geschrieben wird in einen gemeinsamen Raum auf dem Server; beide Seiten
 * hören auf denselben Raum. Nach dem Ende ist der Verlauf für beide weg –
 * einsehbar bleibt er 72 Stunden ausschliesslich für die Moderation, und
 * jeder Blick dorthin wird protokolliert.
 */

export type ChatStatus = 'idle' | 'suche' | 'aktiv' | 'beendet'
export type EndReason = 'selbst' | 'gemeldet' | 'naechster' | 'blockiert' | 'partner'

interface ChatState {
  status: ChatStatus
  roomId: string | null
  partner: Partner | null
  messages: Message[]
  partnerTyping: boolean
  partnerOnline: boolean
  filter: MatchFilter
  error: string | null
  /** Setzt die Oberfläche auf den Hinweis "Tarifgrenze erreicht". */
  grenzeErreicht: boolean
  endReason: EndReason | null
  lastReport: Report | null
  /** Wie viele Leute gerade sonst noch warten – Anzeige in der Warteschlange. */
  wartende: number

  setFilter: (filter: MatchFilter) => void
  startSearch: () => Promise<void>
  cancelSearch: () => void
  sendMessage: (text: string) => Promise<void>
  notifyTyping: () => void
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
let unsubMessages: (() => void) | null = null
let unsubRoom: (() => void) | null = null
let heartbeat: number | null = null
let letztesTippen = 0

function systemMessage(text: string): Message {
  return { id: generateId('sys'), author: 'system', text, ts: Date.now() }
}

function toMessage(live: LiveMessage): Message {
  return { id: live.id, author: live.author, text: live.text, ts: live.ts, flag: live.flag }
}

function stopRun() {
  controller?.abort()
  controller = null
  unsubMessages?.()
  unsubRoom?.()
  unsubMessages = null
  unsubRoom = null
  if (heartbeat !== null) {
    window.clearInterval(heartbeat)
    heartbeat = null
  }
  runToken += 1
}

export const useChat = create<ChatState>((set, get) => {
  /** Hängt sich an den Raum: Nachrichten, Tippen, Anwesenheit, Verlassen. */
  function betrete(roomId: string, token: number, begruessung: Message) {
    unsubMessages = api.watchMessages(roomId, (live) => {
      if (token !== runToken) return
      set({ messages: [begruessung, ...live.map(toMessage)] })
    })

    unsubRoom = api.watchRoom(roomId, (zustand) => {
      if (token !== runToken) return
      set({ partnerTyping: zustand.partnerTyping, partnerOnline: zustand.partnerOnline })
      if (zustand.partnerLeft && get().status === 'aktiv') {
        get().endChat('partner')
      }
    })

    void api.markSeen(roomId)
    heartbeat = window.setInterval(() => void api.markSeen(roomId), api.HEARTBEAT_MS)
  }

  return {
    status: 'idle',
    roomId: null,
    partner: null,
    messages: [],
    partnerTyping: false,
    partnerOnline: true,
    filter: { language: 'egal', interests: [] },
    error: null,
    grenzeErreicht: false,
    endReason: null,
    lastReport: null,
    wartende: 0,

    setFilter(filter) {
      set({ filter })
    },

    async startSearch() {
      const ich = useSession.getState().user
      if (!ich) return

      stopRun()
      controller = new AbortController()
      const token = runToken

      set({
        status: 'suche',
        roomId: null,
        partner: null,
        messages: [],
        partnerTyping: false,
        partnerOnline: true,
        error: null,
        grenzeErreicht: false,
        endReason: null,
        lastReport: null,
        wartende: 0,
      })

      // Vorher prüfen, nachher zählen: Wer abbricht, ohne jemanden getroffen
      // zu haben, soll dafür kein Guthaben verlieren – und wer schon am
      // Anschlag ist, soll nicht erst vergeblich warten.
      if (verbleibend(ich) === 0) {
        set({ status: 'idle', grenzeErreicht: true })
        return
      }

      try {
        const treffer = await api.findMatch(get().filter, ich, {
          bevorzugt: grenzenFuer(ich).bevorzugt,
          signal: controller.signal,
          onWartende: (anzahl) => {
            if (token === runToken) set({ wartende: anzahl })
          },
        })
        if (token !== runToken) return

        // Der Treffer steht – jetzt zählt er. Scheitert das Zählen, geht der
        // Chat trotzdem weiter: ein verlorener Zähler ist kein Grund, zwei
        // Menschen wieder auseinanderzureissen.
        const zaehlung = await api.registerChatStart().catch(() => null)
        if (zaehlung && !zaehlung.erlaubt) {
          await api.leaveRoom(treffer.roomId)
          set({ status: 'idle', grenzeErreicht: true })
          return
        }
        void useSession.getState().refreshUser()

        const partner: Partner = { id: treffer.partnerId, pseudonym: treffer.partnerPseudonym }
        const begruessung = systemMessage(
          `Verbunden mit ${partner.pseudonym}. Beide Seiten sind verifiziert. Der Verlauf wird 72 Stunden für die Missbrauchsprüfung aufbewahrt und danach gelöscht.`,
        )

        set({ status: 'aktiv', roomId: treffer.roomId, partner, messages: [begruessung] })
        betrete(treffer.roomId, token, begruessung)
      } catch (error) {
        if (token !== runToken) return
        if (error instanceof api.ApiError && error.code === 'abgebrochen') return
        set({
          status: 'idle',
          error:
            error instanceof api.ApiError && error.code === 'verweigert'
              ? error.message
              : 'Die Suche ist fehlgeschlagen. Bitte erneut versuchen.',
        })
      }
    },

    cancelSearch() {
      stopRun()
      void api.leaveQueue()
      set({ status: 'idle', partner: null, partnerTyping: false, error: null, wartende: 0 })
    },

    async sendMessage(text) {
      const { roomId, status } = get()
      if (!roomId || status !== 'aktiv') return
      try {
        await api.sendRoomMessage(roomId, text)
      } catch (error) {
        set({ error: error instanceof api.ApiError ? error.message : 'Die Nachricht ging nicht raus.' })
      }
    },

    /** Der Tippindikator wird gedrosselt – nicht bei jedem Anschlag ein Schreibzugriff. */
    notifyTyping() {
      const { roomId, status } = get()
      if (!roomId || status !== 'aktiv') return
      const jetzt = Date.now()
      if (jetzt - letztesTippen < 3_000) return
      letztesTippen = jetzt
      void api.setTyping(roomId)
    },

    endChat(reason) {
      const roomId = get().roomId
      if (roomId) void api.leaveRoom(roomId)
      stopRun()
      set({
        status: 'beendet',
        endReason: reason,
        roomId: null,
        partner: null,
        messages: [],
        partnerTyping: false,
      })
    },

    /** Persönliche Blockierung: dieses Konto wird nicht mehr zugelost. */
    async blockAndEnd() {
      const partner = get().partner
      if (!partner) return
      try {
        await api.blockPartner(partner.id)
        await useSession.getState().refreshBlocks()
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
      const { partner, messages, roomId } = get()
      if (!partner) return null
      try {
        const report = await api.submitReport({ reason, note, partner, messages, transcriptId: roomId }, reporter)
        if (roomId) await api.markReported(roomId)
        get().endChat('gemeldet')
        set({ endReason: 'gemeldet', lastReport: report })
        await useSession.getState().refreshBlocks()
        return report
      } catch (error) {
        set({
          error: error instanceof Error && error.message ? error.message : 'Meldung konnte nicht gespeichert werden.',
        })
        return null
      }
    },

    clearError() {
      set({ error: null })
    },

    dismissEnded() {
      set({ status: 'idle', endReason: null, lastReport: null, error: null, grenzeErreicht: false })
    },
  }
})
