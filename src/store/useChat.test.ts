import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Der Chat-Ablauf, ohne Firestore.
 *
 * Geprüft wird, was man von aussen nicht sieht: „Nächste Person" zählt nicht
 * doppelt, ein Gesprächsstarter wird nie gesendet, Feedback geht einmal raus,
 * und die eigene Ausschlussliste reist mit jeder Suche mit.
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
  HEARTBEAT_MS: 20_000,
  findMatch: vi.fn(),
  registerChatStart: vi.fn(),
  leaveRoom: vi.fn(),
  leaveQueue: vi.fn(),
  watchMessages: vi.fn(() => () => {}),
  watchRoom: vi.fn(() => () => {}),
  markSeen: vi.fn(),
  setTyping: vi.fn(),
  sendRoomMessage: vi.fn(),
  sendeFeedback: vi.fn(),
  blockPartner: vi.fn(),
  submitReport: vi.fn(),
  markReported: vi.fn(),
}))

const api = await import('../services/api')
const { useChat } = await import('./useChat')
const { useSession } = await import('./useSession')
const { GESPRAECHSSTARTER } = await import('../content/gespraechsstarter')

const ich = {
  id: 'ich',
  pseudonym: 'Blauer Falke 1',
  verified: true,
  verificationStatus: 'verifiziert',
  verifiedAt: null,
  phone: null,
  profile: { language: 'de', ageGroup: '25–34', interests: ['Musik'] },
  membership: { plan: 'frei', seit: new Date(0).toISOString(), bis: null },
  usage: { tag: '2000-01-01', chats: 0 },
  planChosen: true,
  rolle: 'nutzer',
  geschlecht: null,
}

let treffer = 0
function naechsterTreffer() {
  treffer += 1
  return { roomId: `raum-${treffer}`, partnerId: `partner-${treffer}`, partnerPseudonym: `Gegenüber ${treffer}` }
}

beforeEach(() => {
  vi.clearAllMocks()
  treffer = 0
  vi.mocked(api.findMatch).mockImplementation(async () => naechsterTreffer())
  vi.mocked(api.registerChatStart).mockResolvedValue({ erlaubt: true, verbleibend: 5 })
  vi.mocked(api.leaveRoom).mockResolvedValue()
  vi.mocked(api.sendeFeedback).mockResolvedValue()
  useSession.setState({
    user: ich as never,
    selfBlocked: ['ausgeschlossen-1'],
    refreshUser: vi.fn(async () => {}),
    refreshBlocks: vi.fn(async () => {}),
  })
  useChat.setState({
    status: 'idle',
    roomId: null,
    partner: null,
    filter: { language: 'de', interests: ['Musik'] },
    letzterChat: null,
    entwurf: '',
    erweitert: false,
  })
})

describe('Nächste Person', () => {
  it('beendet den Chat einmal und zählt nur den neuen Treffer', async () => {
    await useChat.getState().startSearch()
    expect(useChat.getState().roomId).toBe('raum-1')
    expect(api.registerChatStart).toHaveBeenCalledTimes(1)

    await useChat.getState().nextChat()

    expect(api.leaveRoom).toHaveBeenCalledTimes(1)
    expect(api.leaveRoom).toHaveBeenCalledWith('raum-1', { vermerken: true })
    // Ein Treffer, eine Zählung – der alte Chat wird nicht noch einmal gezählt.
    expect(api.registerChatStart).toHaveBeenCalledTimes(2)
    expect(useChat.getState().status).toBe('aktiv')
    expect(useChat.getState().roomId).toBe('raum-2')
  })

  it('behält die Filter und die Ausschlussliste', async () => {
    await useChat.getState().startSearch()
    await useChat.getState().nextChat()
    const aufrufe = vi.mocked(api.findMatch).mock.calls
    expect(aufrufe).toHaveLength(2)
    for (const [filter, , optionen] of aufrufe) {
      expect(filter).toEqual({ language: 'de', interests: ['Musik'] })
      expect(optionen.ausgeschlossen).toEqual(['ausgeschlossen-1'])
    }
  })

  it('hält sich an die Tagesgrenze', async () => {
    await useChat.getState().startSearch()
    vi.mocked(api.registerChatStart).mockResolvedValue({ erlaubt: false, verbleibend: 0 })
    await useChat.getState().nextChat()
    expect(useChat.getState().status).toBe('idle')
    expect(useChat.getState().grenzeErreicht).toBe(true)
  })
})

describe('Suche erweitern', () => {
  it('ändert den Filter nur nach Zustimmung – und nur für diese Suche', async () => {
    // Wie die echte Suche: läuft, bis abgebrochen wird, und räumt dann auf.
    const aufgeraeumt: string[] = []
    vi.mocked(api.findMatch).mockImplementationOnce(
      (_filter, _ich, optionen) =>
        new Promise((_, reject) =>
          optionen.signal?.addEventListener('abort', () => {
            aufgeraeumt.push('alte Suche')
            reject(new ApiError('Abgebrochen.', 'abgebrochen'))
          }),
        ),
    )
    void useChat.getState().startSearch()
    expect(vi.mocked(api.findMatch).mock.calls[0][0]).toEqual({ language: 'de', interests: ['Musik'] })

    await useChat.getState().sucheErweitern()
    // Die alte Suche war beendet, bevor die neue begann.
    expect(aufgeraeumt).toEqual(['alte Suche'])
    const [filter, , optionen] = vi.mocked(api.findMatch).mock.calls[1]
    expect(filter).toEqual({ language: 'de', interests: [] })
    // Der Schutz bleibt: Ausgeschlossene bleiben ausgeschlossen.
    expect(optionen.ausgeschlossen).toEqual(['ausgeschlossen-1'])
    // Die gewählte Einstellung selbst bleibt unangetastet.
    expect(useChat.getState().filter.interests).toEqual(['Musik'])
    expect(useChat.getState().status).toBe('aktiv')

    await useChat.getState().nextChat()
    expect(vi.mocked(api.findMatch).mock.calls[2][0]).toEqual({ language: 'de', interests: ['Musik'] })
  })

  it('tut ausserhalb einer Suche nichts', async () => {
    await useChat.getState().sucheErweitern()
    expect(api.findMatch).not.toHaveBeenCalled()
  })
})

describe('Gesprächsstarter', () => {
  it('setzt den Vorschlag nur ins Eingabefeld und sendet nie', async () => {
    await useChat.getState().startSearch()
    const text = GESPRAECHSSTARTER[0].text
    useChat.getState().vorschlagEinfuegen(text)
    expect(useChat.getState().entwurf).toBe(text)
    expect(api.sendRoomMessage).not.toHaveBeenCalled()
  })

  it('verwirft den Entwurf mit dem Ende des Chats', async () => {
    await useChat.getState().startSearch()
    useChat.getState().vorschlagEinfuegen('Hallo')
    useChat.getState().endChat('selbst')
    expect(useChat.getState().entwurf).toBe('')
  })
})

describe('Feedback', () => {
  it('geht pro Gespräch höchstens einmal raus', async () => {
    await useChat.getState().startSearch()
    useChat.getState().endChat('selbst')
    await useChat.getState().gibFeedback('gut')
    await useChat.getState().gibFeedback('unangenehm')
    expect(api.sendeFeedback).toHaveBeenCalledTimes(1)
    expect(api.sendeFeedback).toHaveBeenCalledWith('raum-1', 'partner-1', 'gut')
    expect(useChat.getState().letzterChat?.feedback).toBe('gesendet')
  })

  it('fragt nach Melden oder Ausschliessen nicht', async () => {
    await useChat.getState().startSearch()
    useChat.getState().endChat('blockiert')
    expect(useChat.getState().letzterChat?.feedback).toBe('keins')
    await useChat.getState().gibFeedback('unangenehm')
    expect(api.sendeFeedback).not.toHaveBeenCalled()
  })

  it('lässt sich überspringen', async () => {
    await useChat.getState().startSearch()
    useChat.getState().endChat('partner')
    useChat.getState().feedbackUeberspringen()
    await useChat.getState().gibFeedback('gut')
    expect(api.sendeFeedback).not.toHaveBeenCalled()
    // Ist das Gegenüber gegangen, hat es das Ende schon vermerkt.
    expect(api.leaveRoom).toHaveBeenCalledWith('raum-1', { vermerken: false })
  })

  it('bietet es erneut an, wenn das Speichern scheitert', async () => {
    vi.mocked(api.sendeFeedback).mockRejectedValueOnce(new Error('offline'))
    await useChat.getState().startSearch()
    useChat.getState().endChat('selbst')
    expect(await useChat.getState().gibFeedback('neutral')).toBe(false)
    expect(useChat.getState().letzterChat?.feedback).toBe('offen')
  })
})
