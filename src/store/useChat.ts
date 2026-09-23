import { create } from 'zustand'
import * as api from '../services/api'
import { generateId } from '../services/pseudonym'
import { grenzenFuer, verbleibend } from '../services/plans'
import { erweitereFilter } from '../services/matching'
import { nachFeedbackFragen, type FeedbackWert } from '../services/feedback'
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

/**
 * Das zuletzt beendete Gespräch – für das optionale Feedback.
 *
 * Nur Raum und Gegenüber, kein Inhalt. `feedback` sagt, ob noch gefragt
 * wird: 'keins' nach Melden und Ausschliessen (die Antwort ist gegeben).
 */
export interface LetzterChat {
  roomId: string
  partnerId: string
  grund: EndReason
  feedback: 'offen' | 'gesendet' | 'uebersprungen' | 'keins'
}

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
  /**
   * Was die Suche gerade sieht – nur für die Stufe in der Warteschlange,
   * die keine Zahlen zeigt. `null`, solange noch nichts gesehen wurde.
   */
  sicht: { kandidaten: number; passend: number } | null
  /** Hat die Person zugestimmt, diese Suche ohne Interessenfilter fortzusetzen? */
  erweitert: boolean
  letzterChat: LetzterChat | null
  /** Der Text im Eingabefeld – hier, damit ein Vorschlag ihn füllen kann. */
  entwurf: string

  setFilter: (filter: MatchFilter) => void
  /** Sucht mit dem gewählten Filter – auch „Nächste Person" nach dem Ende. */
  startSearch: () => Promise<void>
  /** Nur nach Zustimmung: dieselbe Suche ohne Interessenfilter fortsetzen. */
  sucheErweitern: () => Promise<void>
  cancelSearch: () => void
  sendMessage: (text: string) => Promise<void>
  notifyTyping: () => void
  endChat: (reason: EndReason) => void
  blockAndEnd: () => Promise<void>
  nextChat: () => Promise<void>
  report: (reason: ReportReason, note: string, reporter: User) => Promise<Report | null>
  clearError: () => void
  dismissEnded: () => void
  setEntwurf: (text: string) => void
  /** Setzt einen Gesprächsstarter ins Eingabefeld – gesendet wird er nie von selbst. */
  vorschlagEinfuegen: (text: string) => void
  /** `false`, wenn es nicht gespeichert werden konnte. */
  gibFeedback: (wert: FeedbackWert) => Promise<boolean>
  feedbackUeberspringen: () => void
}

/** Laufzeit-Handles bewusst ausserhalb des States: sie sind kein UI-Zustand. */
let controller: AbortController | null = null
let runToken = 0
let unsubMessages: (() => void) | null = null
let unsubRoom: (() => void) | null = null
let heartbeat: number | null = null
let letztesTippen = 0
/** Die laufende Suche – damit eine neue erst beginnt, wenn die alte aufgeräumt hat. */
let laufendeSuche: Promise<void> | null = null

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

  /** Die eigentliche Suche; `erweitert` nur nach ausdrücklicher Zustimmung. */
  async function suche(erweitert: boolean) {
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
      sicht: null,
      erweitert,
      entwurf: '',
    })

    // Vorher prüfen, nachher zählen: Wer abbricht, ohne jemanden getroffen
    // zu haben, soll dafür kein Guthaben verlieren – und wer schon am
    // Anschlag ist, soll nicht erst vergeblich warten.
    if (verbleibend(ich) === 0) {
      set({ status: 'idle', grenzeErreicht: true })
      return
    }

    // Erweitert wird nur der Interessenfilter; die Sprache bleibt.
    const filter = erweitereFilter(get().filter, erweitert)

    try {
      const treffer = await api.findMatch(filter, ich, {
        bevorzugt: grenzenFuer(ich).bevorzugt,
        signal: controller.signal,
        // „Nicht mehr verbinden" und gemeldete Konten – auch nach einer
        // erweiterten Suche.
        ausgeschlossen: useSession.getState().selfBlocked,
        onSicht: (sicht) => {
          if (token === runToken) set({ sicht })
        },
      })
      if (token !== runToken) {
        // Abgebrochen, während der Raum schon entstand: nicht einfach liegen
        // lassen, sonst wartet das Gegenüber in einem leeren Raum.
        void api.leaveRoom(treffer.roomId)
        return
      }

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

      set({ status: 'aktiv', roomId: treffer.roomId, partner, messages: [begruessung], letzterChat: null })
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
    sicht: null,
    erweitert: false,
    letzterChat: null,
    entwurf: '',

    setFilter(filter) {
      set({ filter })
    },

    startSearch() {
      laufendeSuche = suche(false)
      return laufendeSuche
    },

    async sucheErweitern() {
      if (get().status !== 'suche' || get().erweitert) return
      // Erst die alte Suche vollständig beenden: Sie räumt beim Abbrechen den
      // eigenen Warteschlangeneintrag weg – liefe die neue schon, wäre es
      // deren Eintrag, und niemand könnte sie mehr finden.
      stopRun()
      await laufendeSuche?.catch(() => {})
      laufendeSuche = suche(true)
      await laufendeSuche
    },

    cancelSearch() {
      stopRun()
      void api.leaveQueue()
      set({ status: 'idle', partner: null, partnerTyping: false, error: null, sicht: null, erweitert: false })
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
      const { roomId, partner } = get()
      // Ist das Gegenüber gegangen, hat es das Ende schon vermerkt.
      if (roomId) void api.leaveRoom(roomId, { vermerken: reason !== 'partner' })
      stopRun()
      set({
        status: 'beendet',
        endReason: reason,
        roomId: null,
        partner: null,
        messages: [],
        partnerTyping: false,
        entwurf: '',
        letzterChat:
          roomId && partner
            ? { roomId, partnerId: partner.id, grund: reason, feedback: nachFeedbackFragen(reason) ? 'offen' : 'keins' }
            : null,
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
      set({ status: 'idle', endReason: null, lastReport: null, error: null, grenzeErreicht: false, letzterChat: null })
    },

    setEntwurf(text) {
      set({ entwurf: text })
    },

    vorschlagEinfuegen(text) {
      if (get().status !== 'aktiv') return
      set({ entwurf: text })
    },

    /** Einmal pro Gespräch; das Gegenüber erfährt nie davon. */
    async gibFeedback(wert) {
      const letzter = get().letzterChat
      if (!letzter || letzter.feedback !== 'offen') return false
      // Sofort als gesendet markieren: Ein zweiter Tipp geht nicht noch einmal raus.
      set({ letzterChat: { ...letzter, feedback: 'gesendet' } })
      try {
        await api.sendeFeedback(letzter.roomId, letzter.partnerId, wert)
        return true
      } catch {
        // Nicht gespeichert: wieder anbieten, statt „Danke" zu sagen.
        const jetzt = get().letzterChat
        if (jetzt?.roomId === letzter.roomId) set({ letzterChat: { ...jetzt, feedback: 'offen' } })
        return false
      }
    },

    feedbackUeberspringen() {
      const letzter = get().letzterChat
      if (letzter?.feedback === 'offen') set({ letzterChat: { ...letzter, feedback: 'uebersprungen' } })
    },
  }
})
