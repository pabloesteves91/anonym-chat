import { create } from 'zustand'
import * as api from '../services/mockApi'
import type {
  AccessLogEntry,
  ChatTranscript,
  Report,
  ReportStatus,
  VerificationImages,
  VerificationRequest,
} from '../services/types'

/** Datenquelle der Moderationsansicht. */
interface ModerationState {
  ready: boolean
  busy: boolean
  reports: Report[]
  blocked: string[]
  requests: VerificationRequest[]
  /** Bildvorschauen je Antrag – nur solange die Browsersitzung läuft. */
  images: Record<string, VerificationImages>
  transcripts: ChatTranscript[]
  /** Geöffnete Verläufe dieser Sitzung, je Eintrag protokolliert. */
  opened: Record<string, ChatTranscript>
  accessLog: AccessLogEntry[]

  load: () => Promise<void>
  openTranscript: (id: string) => Promise<void>
  deleteTranscript: (id: string) => Promise<void>
  decide: (requestId: string, decision: 'freigegeben' | 'abgelehnt', reason?: string) => Promise<void>
  setStatus: (id: string, status: ReportStatus) => Promise<void>
  clearAll: () => Promise<void>
}

export const useModeration = create<ModerationState>((set, get) => ({
  ready: false,
  busy: false,
  reports: [],
  blocked: [],
  requests: [],
  images: {},
  transcripts: [],
  opened: {},
  accessLog: [],

  async load() {
    const [reports, blocked, requests, transcripts, accessLog] = await Promise.all([
      api.listReports(),
      api.listBlocked(),
      api.listVerificationRequests(),
      api.listTranscripts(),
      api.listAccessLog(),
    ])

    // Bilder nur für offene Anträge holen – entschiedene haben keine mehr.
    const offen = requests.filter((request) => request.status === 'wartet')
    const paare = await Promise.all(
      offen.map(async (request) => [request.id, await api.getVerificationImages(request.id)] as const),
    )
    set({ reports, blocked, requests, transcripts, accessLog, images: Object.fromEntries(paare), ready: true })
  },

  async openTranscript(id) {
    // Sperren, solange der Zugriff läuft: ein Doppelklick wäre sonst zwei
    // Einträge im Protokoll für ein einziges Mitlesen.
    if (get().busy) return
    set({ busy: true })
    const transcript = await api.openTranscript(id)
    if (!transcript) {
      // Abgelaufen oder bereits gelöscht – Liste auffrischen statt ins Leere zeigen.
      set({ transcripts: await api.listTranscripts(), busy: false })
      return
    }
    const accessLog = await api.listAccessLog()
    set((state) => ({ opened: { ...state.opened, [id]: transcript }, accessLog, busy: false }))
  },

  async deleteTranscript(id) {
    set({ busy: true })
    const transcripts = await api.deleteTranscript(id)
    const accessLog = await api.listAccessLog()
    set((state) => {
      const opened = { ...state.opened }
      delete opened[id]
      return { transcripts, accessLog, opened, busy: false }
    })
  },

  async decide(requestId, decision, reason) {
    set({ busy: true })
    const requests = await api.decideVerification(requestId, decision, reason)
    set((state) => {
      const images = { ...state.images }
      delete images[requestId]
      return { requests, images, busy: false }
    })
  },

  async setStatus(id, status) {
    set({ busy: true })
    const reports = await api.updateReportStatus(id, status)
    const blocked = await api.listBlocked()
    set({ reports, blocked, busy: false })
  },

  async clearAll() {
    set({ busy: true })
    await api.clearReports()
    set({ reports: [], blocked: [], transcripts: [], accessLog: [], opened: {}, busy: false })
  },
}))
