import { create } from 'zustand'
import * as api from '../services/api'
import type { PlanId } from '../services/plans'
import type {
  AccessLogEntry,
  ChatTranscript,
  PlanRequest,
  Report,
  ReportStatus,
  VerificationImages,
  VerificationRequest,
} from '../services/types'

/**
 * Jede Aktion hier setzt `busy`, und `busy` sperrt sämtliche Knöpfe der
 * Ansicht. Bleibt es nach einem Fehlschlag stehen, ist die ganze Moderation
 * blockiert – ohne dass irgendwo stünde, warum. Deshalb gibt jede Aktion
 * `busy` im `finally` wieder frei und legt die Meldung ab.
 */
const meldung = (error: unknown, fallback: string) =>
  error instanceof api.ApiError ? error.message : fallback

/**
 * Holt die Bilder offener Anträge und reicht sie einzeln nach.
 *
 * Einer nach dem anderen, damit ein hängender Abruf die übrigen nicht
 * aufhält, und jeder für sich abgesichert: Ein fehlendes Bild macht einen
 * Antrag nicht unentscheidbar – die Moderation sieht dann, dass es fehlt.
 */
async function ladeBilder(
  set: (fn: (state: ModerationState) => Partial<ModerationState>) => void,
  requests: VerificationRequest[],
): Promise<void> {
  for (const request of requests.filter((eintrag) => eintrag.status === 'wartet')) {
    try {
      const bilder = await api.getVerificationImages(request.id)
      set((state) => ({ images: { ...state.images, [request.id]: bilder } }))
    } catch {
      set((state) => ({ images: { ...state.images, [request.id]: { ausweis: null, selfie: null } } }))
    }
  }
}

/** Datenquelle der Moderationsansicht. */
interface ModerationState {
  ready: boolean
  busy: boolean
  /** Warum die Ansicht leer bleibt – sonst lädt sie scheinbar endlos. */
  error: string | null
  reports: Report[]
  blocked: string[]
  requests: VerificationRequest[]
  /** Bildvorschauen je Antrag – nur solange die Browsersitzung läuft. */
  images: Record<string, VerificationImages>
  transcripts: ChatTranscript[]
  /** Wer welchen Tarif möchte – solange die Kasse fehlt, der einzige Weg dorthin. */
  planRequests: PlanRequest[]
  /** Geöffnete Verläufe dieser Sitzung, je Eintrag protokolliert. */
  opened: Record<string, ChatTranscript>
  accessLog: AccessLogEntry[]

  load: () => Promise<void>
  openTranscript: (id: string) => Promise<void>
  deleteTranscript: (id: string) => Promise<void>
  decide: (requestId: string, decision: 'freigegeben' | 'abgelehnt', reason?: string) => Promise<void>
  /** Tarif von Hand vergeben, solange es keine Kasse gibt. */
  setPlan: (userId: string, plan: PlanId, laufzeitTage: number | null) => Promise<boolean>
  setStatus: (id: string, status: ReportStatus) => Promise<void>
  clearAll: () => Promise<void>
}

export const useModeration = create<ModerationState>((set, get) => ({
  ready: false,
  busy: false,
  error: null,
  reports: [],
  blocked: [],
  requests: [],
  images: {},
  transcripts: [],
  planRequests: [],
  opened: {},
  accessLog: [],

  async load() {
    set({ error: null })
    try {
      const [reports, blocked, requests, transcripts, accessLog, planRequests] = await Promise.all([
        api.listReports(),
        api.listBlocked(),
        api.listVerificationRequests(),
        api.listTranscripts(),
        api.listAccessLog(),
        api.listPlanRequests(),
      ])
      set({ reports, blocked, requests, transcripts, accessLog, planRequests, ready: true })

      // Die Bilder kommen aus dem Dateispeicher und damit über eine zweite
      // Verbindung. Sie dürfen die Ansicht nicht aufhalten: Wartet die
      // Liste auf sie, verschwinden bei einer langsamen oder gesperrten
      // Antwort auch Anträge, Verläufe und Meldungen – und niemand sähe,
      // woran es liegt. Sie werden deshalb nachgereicht.
      void ladeBilder(set, requests)
    } catch (error) {
      // Ein Fehlschlag muss enden: Bleibt `ready` auf false, zeigt die
      // Ansicht für immer "wird geladen" und sieht aus wie ein Hänger.
      set({ ready: true, error: meldung(error, 'Die Moderationsdaten konnten nicht geladen werden.') })
    }
  },

  async openTranscript(id) {
    // Sperren, solange der Zugriff läuft: ein Doppelklick wäre sonst zwei
    // Einträge im Protokoll für ein einziges Mitlesen.
    if (get().busy) return
    set({ busy: true, error: null })
    try {
      const transcript = await api.openTranscript(id)
      if (!transcript) {
        // Abgelaufen oder bereits gelöscht – Liste auffrischen statt ins Leere zeigen.
        set({ transcripts: await api.listTranscripts() })
        return
      }
      const accessLog = await api.listAccessLog()
      set((state) => ({ opened: { ...state.opened, [id]: transcript }, accessLog }))
    } catch (error) {
      set({ error: meldung(error, 'Der Verlauf konnte nicht geöffnet werden.') })
    } finally {
      set({ busy: false })
    }
  },

  async deleteTranscript(id) {
    set({ busy: true, error: null })
    try {
      const transcripts = await api.deleteTranscript(id)
      const accessLog = await api.listAccessLog()
      set((state) => {
        const opened = { ...state.opened }
        delete opened[id]
        return { transcripts, accessLog, opened }
      })
    } catch (error) {
      set({ error: meldung(error, 'Der Verlauf konnte nicht gelöscht werden.') })
    } finally {
      set({ busy: false })
    }
  },

  async decide(requestId, decision, reason) {
    set({ busy: true, error: null })
    try {
      const requests = await api.decideVerification(requestId, decision, reason)
      set((state) => {
        const images = { ...state.images }
        delete images[requestId]
        return { requests, images }
      })
    } catch (error) {
      set({ error: meldung(error, 'Der Entscheid konnte nicht gespeichert werden.') })
    } finally {
      set({ busy: false })
    }
  },

  async setPlan(userId, plan, laufzeitTage) {
    set({ busy: true, error: null })
    try {
      await api.setMembership(userId, plan, laufzeitTage)
      set({ planRequests: await api.listPlanRequests() })
      return true
    } catch (error) {
      set({ error: meldung(error, 'Der Tarif konnte nicht gesetzt werden.') })
      return false
    } finally {
      set({ busy: false })
    }
  },

  async setStatus(id, status) {
    set({ busy: true, error: null })
    try {
      const reports = await api.updateReportStatus(id, status)
      const blocked = await api.listBlocked()
      set({ reports, blocked })
    } catch (error) {
      set({ error: meldung(error, 'Der Status konnte nicht gesetzt werden.') })
    } finally {
      set({ busy: false })
    }
  },

  async clearAll() {
    set({ busy: true, error: null })
    try {
      await api.clearReports()
      // Das Zugriffsprotokoll bleibt – es lässt sich gar nicht löschen.
      set({ reports: [], blocked: [], transcripts: [], opened: {} })
    } catch (error) {
      set({ error: meldung(error, 'Das Aufräumen ist fehlgeschlagen.') })
    } finally {
      set({ busy: false })
    }
  },
}))
