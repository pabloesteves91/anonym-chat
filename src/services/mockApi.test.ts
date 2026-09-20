import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './mockApi'
import { KEYS } from './storage'
import type { Message, Partner, User } from './types'

/**
 * Die simulierte Latenz wird mit falschen Timern übersprungen – die Tests
 * prüfen das Verhalten, nicht die Wartezeit.
 */
async function settle<T>(promise: Promise<T>): Promise<T | Error> {
  const guarded = promise.catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))))
  await vi.advanceTimersByTimeAsync(10_000)
  return guarded
}

const partner: Partner = {
  id: 'usr_k29fa1',
  pseudonym: 'Stiller Kranich 2048',
  language: 'de',
  interests: ['Bücher', 'Wandern', 'Kochen'],
}

const nachricht = (author: Message['author'], text: string, flagged = false): Message => ({
  id: `m_${text}`,
  author,
  text,
  ts: Date.now(),
  flag: flagged ? { level: 'mild', reason: 'Beleidigung', terms: ['x'] } : undefined,
})

beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const bild = (name: string) => ({
  dataUrl: `data:image/jpeg;base64,${name}`,
  meta: { name: `${name}.jpg`, size: 1024, type: 'image/jpeg' },
})

async function eingereicht() {
  const { code } = (await settle(api.requestSmsCode('079 123 45 67'))) as { code: string }
  const phone = (await settle(api.confirmSmsCode(code))) as string
  return (await settle(
    api.submitVerification({ phone, ausweis: bild('ausweis'), selfie: bild('selfie') }),
  )) as Awaited<ReturnType<typeof api.submitVerification>>
}

describe('SMS-Bestätigung', () => {
  it('normalisiert Schweizer Nummern und weist Unsinn ab', async () => {
    expect(api.normalizePhone('079 123 45 67')).toBe('+41791234567')
    expect(api.normalizePhone('+49 170 1234567')).toBe('+491701234567')
    expect(api.normalizePhone('hallo')).toBeNull()

    const result = await settle(api.requestSmsCode('12'))
    expect((result as api.ApiError).code).toBe('ungueltig')
  })

  it('zeigt die Nummer nur maskiert', () => {
    expect(api.maskPhone('+41791234567')).not.toContain('123456')
    expect(api.maskPhone('+41791234567')).toContain('67')
  })

  it('akzeptiert nur den gesendeten Code und zählt Fehlversuche', async () => {
    const { code } = (await settle(api.requestSmsCode('079 123 45 67'))) as { code: string }

    const falsch = await settle(api.confirmSmsCode('000000'))
    expect((falsch as api.ApiError).code).toBe('ungueltig')

    const phone = await settle(api.confirmSmsCode(code))
    expect(phone).toBe('+41791234567')
  })

  it('lässt abgelaufene Codes nicht mehr zu', async () => {
    const { code } = (await settle(api.requestSmsCode('079 123 45 67'))) as { code: string }
    vi.setSystemTime(Date.now() + 11 * 60 * 1000)
    const result = await settle(api.confirmSmsCode(code))
    expect((result as api.ApiError).message).toMatch(/abgelaufen/)
  })
})

describe('Verifizierungsantrag', () => {
  it('reicht ein, ohne selbst freizugeben', async () => {
    const request = await eingereicht()
    expect(request.status).toBe('wartet')
    expect(request.phoneMasked).not.toContain('1234567')

    const session = (await settle(api.getSession())) as Awaited<ReturnType<typeof api.getSession>>
    expect(session.user?.verified).toBe(false)
    expect(session.user?.verificationStatus).toBe('wartet')
  })

  it('legt die Bilder nur im Sitzungsspeicher ab', async () => {
    const request = await eingereicht()
    const images = (await settle(api.getVerificationImages(request.id))) as { ausweis: string | null }
    expect(images.ausweis).toContain('data:image/jpeg')
    expect(window.localStorage.getItem(KEYS.requests)).not.toContain('data:image')
  })

  it('verifiziert erst durch die Entscheidung der Moderation', async () => {
    const request = await eingereicht()
    await settle(api.decideVerification(request.id, 'freigegeben'))

    const session = (await settle(api.getSession())) as Awaited<ReturnType<typeof api.getSession>>
    expect(session.user?.verified).toBe(true)
    expect(session.user?.verificationStatus).toBe('verifiziert')
    // Nach dem Entscheid sind die Bilder weg.
    expect(((await settle(api.getVerificationImages(request.id))) as { selfie: string | null }).selfie).toBeNull()
  })

  it('hält eine Ablehnung mit Begründung fest', async () => {
    const request = await eingereicht()
    await settle(api.decideVerification(request.id, 'abgelehnt', 'Ausweis nicht lesbar'))

    const session = (await settle(api.getSession())) as Awaited<ReturnType<typeof api.getSession>>
    expect(session.user?.verified).toBe(false)
    expect(session.user?.verificationStatus).toBe('abgelehnt')

    const meins = (await settle(api.getMyVerification())) as Awaited<ReturnType<typeof api.getMyVerification>>
    expect(meins?.rejectionReason).toBe('Ausweis nicht lesbar')
  })

  it('ersetzt beim erneuten Einreichen den alten Antrag', async () => {
    const erste = await eingereicht()
    await settle(api.decideVerification(erste.id, 'abgelehnt', 'Dokument abgelaufen'))
    await settle(api.withdrawVerification())
    const zweite = await eingereicht()

    const alle = (await settle(api.listVerificationRequests())) as Awaited<
      ReturnType<typeof api.listVerificationRequests>
    >
    expect(alle).toHaveLength(1)
    expect(alle[0].id).toBe(zweite.id)
  })

  it('lehnt Profiländerungen ohne Identität ab', async () => {
    const result = await settle(api.updateProfile({ language: 'de', ageGroup: '25–34', interests: [] }))
    expect((result as api.ApiError).code).toBe('nicht-verifiziert')
  })
})

describe('Matching', () => {
  it('berücksichtigt den Sprachfilter', async () => {
    const treffer = (await settle(api.findMatch({ language: 'it', interests: [] }))) as Partner
    expect(treffer.language).toBe('it')
  })

  it('meldet, wenn der Filter niemanden übrig lässt', async () => {
    const result = await settle(api.findMatch({ language: 'it', interests: ['Games'] }))
    expect((result as api.ApiError).code).toBe('kein-treffer')
  })

  it('schliesst gesperrte und selbst blockierte Konten aus', async () => {
    window.localStorage.setItem(KEYS.blocked, JSON.stringify(['usr_t71ab9']))
    window.localStorage.setItem(KEYS.selfBlocked, JSON.stringify(['usr_z90ii6']))
    const result = await settle(api.findMatch({ language: 'fr', interests: [] }))
    expect((result as api.ApiError).code).toBe('kein-treffer')
  })

  it('bricht die Suche über das Signal ab', async () => {
    const controller = new AbortController()
    const laufend = api.findMatch({ language: 'egal', interests: [] }, controller.signal).catch((e: unknown) => e)
    controller.abort()
    expect((await laufend as api.ApiError).code).toBe('abgebrochen')
  })
})

describe('Meldungen', () => {
  const reporter: User = {
    id: 'usr_self',
    pseudonym: 'Blauer Falke 1234',
    verified: true,
    verificationStatus: 'verifiziert',
    verifiedAt: new Date().toISOString(),
    phone: '+41791234567',
    profile: { language: 'de', ageGroup: '25–34', interests: [] },
  }

  it('zählt nur markierte Nachrichten des gemeldeten Kontos', async () => {
    const messages = [
      nachricht('me', 'du idiot', true),
      nachricht('partner', 'schreib mir auf telegram', true),
      nachricht('partner', 'alles gut'),
    ]
    const report = await settle(api.submitReport({ reason: 'spam', note: ' Test ', partner, messages }, reporter))
    expect((report as Awaited<ReturnType<typeof api.submitReport>>).autoFlags).toBe(1)
    expect((report as Awaited<ReturnType<typeof api.submitReport>>).note).toBe('Test')
  })

  it('blockiert das gemeldete Konto auch für den Melder', async () => {
    await settle(api.submitReport({ reason: 'spam', note: '', partner, messages: [] }, reporter))
    const blockiert = (await settle(api.listSelfBlocked())) as string[]
    expect(blockiert).toContain(partner.id)
  })

  it('hebt eine Sperre nicht auf, solange eine zweite Meldung sie trägt', async () => {
    const erste = (await settle(api.submitReport({ reason: 'spam', note: '', partner, messages: [] }, reporter))) as {
      id: string
    }
    const zweite = (await settle(
      api.submitReport({ reason: 'belaestigung', note: '', partner, messages: [] }, reporter),
    )) as { id: string }

    await settle(api.updateReportStatus(erste.id, 'gesperrt'))
    await settle(api.updateReportStatus(zweite.id, 'gesperrt'))
    // Eine der beiden Meldungen wird abgehakt – die Sperre muss bleiben.
    await settle(api.updateReportStatus(zweite.id, 'geprueft'))

    expect((await settle(api.listBlocked())) as string[]).toContain(partner.id)

    await settle(api.updateReportStatus(erste.id, 'geprueft'))
    expect((await settle(api.listBlocked())) as string[]).not.toContain(partner.id)
  })

  it('meldet einen Fehler, statt eine Vorgangsnummer ohne Vorgang zu liefern', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const result = await settle(api.submitReport({ reason: 'spam', note: '', partner, messages: [] }, reporter))
    expect((result as api.ApiError).code).toBe('speicher')
  })
})

describe('Chatverläufe', () => {
  const owner: User = {
    id: 'usr_self',
    pseudonym: 'Blauer Falke 1234',
    verified: true,
    verificationStatus: 'verifiziert',
    verifiedAt: new Date().toISOString(),
    phone: '+41791234567',
    profile: { language: 'de', ageGroup: '25–34', interests: [] },
  }

  const verlauf = () =>
    api.saveTranscript({
      owner,
      partner,
      messages: [
        nachricht('me', 'hallo'),
        nachricht('partner', 'schreib mir auf telegram', true),
        { id: 'sys', author: 'system', text: 'Verbunden', ts: Date.now() },
      ],
    })

  it('speichert nur echte Nachrichten, keine Systemzeilen', async () => {
    const t = (await settle(verlauf())) as Awaited<ReturnType<typeof api.saveTranscript>>
    expect(t?.messages).toHaveLength(2)
    expect(t?.flagCount).toBe(1)
    expect(t?.reported).toBe(false)
  })

  it('legt für einen Chat ohne Wortwechsel nichts an', async () => {
    const t = await settle(api.saveTranscript({ owner, partner, messages: [] }))
    expect(t).toBeNull()
    expect(((await settle(api.listTranscripts())) as unknown[]).length).toBe(0)
  })

  it('löscht Verläufe nach Ablauf der Frist von selbst', async () => {
    await settle(verlauf())
    expect(((await settle(api.listTranscripts())) as unknown[]).length).toBe(1)

    vi.setSystemTime(Date.now() + api.RETENTION_MS + 1000)
    expect(((await settle(api.listTranscripts())) as unknown[]).length).toBe(0)
    // Auch aus dem Speicher, nicht nur aus der Antwort.
    expect(window.localStorage.getItem(KEYS.transcripts)).toBe('[]')
  })

  it('protokolliert jedes Öffnen und Löschen', async () => {
    const t = (await settle(verlauf())) as { id: string }

    // Die Übersicht allein ist noch kein Mitlesen.
    await settle(api.listTranscripts())
    expect(((await settle(api.listAccessLog())) as unknown[]).length).toBe(0)

    await settle(api.openTranscript(t.id))
    await settle(api.deleteTranscript(t.id))

    const log = (await settle(api.listAccessLog())) as { action: string; transcriptId: string }[]
    expect(log.map((e) => e.action)).toEqual(['geloescht', 'geoeffnet'])
    expect(log.every((e) => e.transcriptId === t.id)).toBe(true)
    expect(((await settle(api.listTranscripts())) as unknown[]).length).toBe(0)
  })

  it('markiert den Verlauf, zu dem gemeldet wurde', async () => {
    const t = (await settle(verlauf())) as { id: string }
    await settle(
      api.submitReport({ reason: 'spam', note: '', partner, messages: [], transcriptId: t.id }, owner),
    )
    const alle = (await settle(api.listTranscripts())) as { reported: boolean }[]
    expect(alle[0].reported).toBe(true)
  })
})

describe('Korrekturen aus dem Review', () => {
  const owner: User = {
    id: 'usr_self',
    pseudonym: 'Blauer Falke 1234',
    verified: true,
    verificationStatus: 'verifiziert',
    verifiedAt: new Date().toISOString(),
    phone: '+41791234567',
    profile: { language: 'de', ageGroup: '25–34', interests: [] },
  }

  const verlauf = () =>
    api.saveTranscript({ owner, partner, messages: [nachricht('me', 'hallo'), nachricht('partner', 'hi')] })

  it('protokolliert keine Löschung, die nicht stattgefunden hat', async () => {
    await settle(verlauf())
    await settle(api.deleteTranscript('chat_gibtsnicht'))
    expect(((await settle(api.listAccessLog())) as unknown[]).length).toBe(0)
    expect(((await settle(api.listTranscripts())) as unknown[]).length).toBe(1)
  })

  it('löscht beim Zurücksetzen der Identität auch Verläufe und Protokoll', async () => {
    const t = (await settle(verlauf())) as { id: string }
    await settle(api.openTranscript(t.id))
    expect(((await settle(api.listAccessLog())) as unknown[]).length).toBe(1)

    // Identität anlegen, die zu den Verläufen passt.
    window.localStorage.setItem(KEYS.user, JSON.stringify(owner))
    await settle(api.resetIdentity())

    expect(((await settle(api.listTranscripts())) as unknown[]).length).toBe(0)
    expect(((await settle(api.listAccessLog())) as unknown[]).length).toBe(0)
  })
})
