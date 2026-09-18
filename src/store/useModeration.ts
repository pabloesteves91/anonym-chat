import { create } from 'zustand'
import * as api from '../services/mockApi'
import type { Report, ReportStatus, VerificationImages, VerificationRequest } from '../services/types'

/** Datenquelle der Moderationsansicht. */
interface ModerationState {
  ready: boolean
  busy: boolean
  reports: Report[]
  blocked: string[]
  requests: VerificationRequest[]
  /** Bildvorschauen je Antrag – nur solange die Browsersitzung läuft. */
  images: Record<string, VerificationImages>

  load: () => Promise<void>
  decide: (requestId: string, decision: 'freigegeben' | 'abgelehnt', reason?: string) => Promise<void>
  setStatus: (id: string, status: ReportStatus) => Promise<void>
  clearAll: () => Promise<void>
}

export const useModeration = create<ModerationState>((set) => ({
  ready: false,
  busy: false,
  reports: [],
  blocked: [],
  requests: [],
  images: {},

  async load() {
    const [reports, blocked, requests] = await Promise.all([
      api.listReports(),
      api.listBlocked(),
      api.listVerificationRequests(),
    ])

    // Bilder nur für offene Anträge holen – entschiedene haben keine mehr.
    const offen = requests.filter((request) => request.status === 'wartet')
    const paare = await Promise.all(
      offen.map(async (request) => [request.id, await api.getVerificationImages(request.id)] as const),
    )
    set({ reports, blocked, requests, images: Object.fromEntries(paare), ready: true })
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
    set({ reports: [], blocked: [], busy: false })
  },
}))
