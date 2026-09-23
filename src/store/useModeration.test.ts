import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression: Die Moderation zeigte nichts, obwohl das Abzeichen "2" meldete.
 *
 * Eine einzige Abfrage – die Verläufe – scheiterte in Betrieb an einem
 * fehlenden Datenbank-Index. Weil alle sieben Listen gemeinsam über
 * `Promise.all` geholt wurden, riss sie Meldungen und Supportanfragen mit:
 * Beide standen auf 0, obwohl sie tadellos lesbar waren.
 *
 * Dieselbe Fehlerklasse gab es schon einmal mit den Ausweisbildern. Diese
 * Datei prüft deshalb das Muster, nicht den einen Fall: Scheitert eine Quelle,
 * bleiben die anderen sichtbar, und die Meldung sagt, welche fehlt.
 */

class ApiError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

vi.mock('../services/api', () => ({
  ApiError,
  listReports: vi.fn(),
  listSupport: vi.fn(),
  listBlocked: vi.fn(),
  listVerificationRequests: vi.fn(),
  listTranscripts: vi.fn(),
  listAccessLog: vi.fn(),
  listPlanRequests: vi.fn(),
  getVerificationImages: vi.fn(),
}))

const api = await import('../services/api')
const { useModeration } = await import('./useModeration')

const meldung = { id: 'rep-1', status: 'offen' }
const anfrage = { id: 'sup-1', status: 'offen', betreff: 'dfdfdyf' }

function allesLiefert() {
  vi.mocked(api.listReports).mockResolvedValue([meldung] as never)
  vi.mocked(api.listSupport).mockResolvedValue([anfrage] as never)
  vi.mocked(api.listBlocked).mockResolvedValue([])
  vi.mocked(api.listVerificationRequests).mockResolvedValue([])
  vi.mocked(api.listTranscripts).mockResolvedValue([])
  vi.mocked(api.listAccessLog).mockResolvedValue([])
  vi.mocked(api.listPlanRequests).mockResolvedValue([])
}

describe('useModeration.load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useModeration.setState({ ready: false, error: null, reports: [], support: [], transcripts: [] })
    allesLiefert()
  })

  it('lädt alles, wenn alles gelingt', async () => {
    await useModeration.getState().load()
    const stand = useModeration.getState()
    expect(stand.reports).toHaveLength(1)
    expect(stand.support).toHaveLength(1)
    expect(stand.error).toBeNull()
    expect(stand.ready).toBe(true)
  })

  it('zeigt Meldungen und Anfragen weiter, wenn die Verläufe scheitern', async () => {
    // Genau der Fall aus dem Betrieb: fehlender Index auf chats.expiresAt.
    vi.mocked(api.listTranscripts).mockRejectedValue(
      new ApiError('Ein Datenbank-Index fehlt oder wird noch aufgebaut.', 'speicher'),
    )

    await useModeration.getState().load()
    const stand = useModeration.getState()

    expect(stand.reports, 'Meldungen dürfen nicht mitgerissen werden').toHaveLength(1)
    expect(stand.support, 'Supportanfragen dürfen nicht mitgerissen werden').toHaveLength(1)
    expect(stand.ready).toBe(true)
  })

  it('nennt in der Meldung, welcher Teil fehlt', async () => {
    vi.mocked(api.listTranscripts).mockRejectedValue(new Error('failed-precondition'))

    await useModeration.getState().load()

    expect(useModeration.getState().error).toMatch(/Verläufe/)
  })

  it('nennt mehrere fehlende Teile zusammen', async () => {
    vi.mocked(api.listTranscripts).mockRejectedValue(new Error('x'))
    vi.mocked(api.listAccessLog).mockRejectedValue(new Error('y'))

    await useModeration.getState().load()
    const fehler = useModeration.getState().error ?? ''

    expect(fehler).toMatch(/Verläufe/)
    expect(fehler).toMatch(/Zugriffsprotokoll/)
    expect(useModeration.getState().support).toHaveLength(1)
  })
})
