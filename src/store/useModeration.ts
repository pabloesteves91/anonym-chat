import { create } from 'zustand'
import * as api from '../services/mockApi'
import type { Report, ReportStatus } from '../services/types'

/** Datenquelle der Moderationsansicht. */
interface ModerationState {
  ready: boolean
  busy: boolean
  reports: Report[]
  blocked: string[]

  load: () => Promise<void>
  setStatus: (id: string, status: ReportStatus) => Promise<void>
  clearAll: () => Promise<void>
}

export const useModeration = create<ModerationState>((set) => ({
  ready: false,
  busy: false,
  reports: [],
  blocked: [],

  async load() {
    const [reports, blocked] = await Promise.all([api.listReports(), api.listBlocked()])
    set({ reports, blocked, ready: true })
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
