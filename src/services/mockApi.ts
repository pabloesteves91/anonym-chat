import {
  KEYS,
  isStorageAvailable,
  readJson,
  readSessionString,
  remove,
  removeSession,
  writeJson,
  writeSessionString,
} from './storage'
import { generateId, generatePseudonym } from './pseudonym'
import { PARTNER_POOL, openerFor, replyFor, typingDurationFor } from './partnerScript'
import { scanText } from './wordFilter'
import type {
  FilterVerdict,
  MatchFilter,
  Message,
  Partner,
  Profile,
  Report,
  ReportInput,
  ReportStatus,
  AccessLogEntry,
  ChatTranscript,
  Session,
  TranscriptMessage,
  UploadMeta,
  User,
  VerificationImages,
  VerificationRequest,
} from './types'

/**
 * Die einzige "Backend"-Grenze des Prototyps.
 *
 * Alles hier ist simuliert: künstliche Latenz, lokaler Datenbestand in
 * localStorage, erfundene Gesprächspartner. Komponenten und Stores rufen
 * ausschliesslich diese Funktionen auf – nie localStorage, nie setTimeout
 * für Fake-Verhalten. Damit kann in Phase 2 ein echter HTTP-/WebSocket-
 * Client eingesetzt werden, ohne UI-Code anzufassen.
 *
 * Alle Funktionen sind async und akzeptieren dort, wo Wartezeit entsteht,
 * ein AbortSignal.
 */

export type ApiErrorCode = 'abgebrochen' | 'kein-treffer' | 'nicht-verifiziert' | 'ungueltig' | 'speicher'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(message: string, code: ApiErrorCode) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError('Vorgang abgebrochen.', 'abgebrochen'))
      return
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      window.clearTimeout(timer)
      reject(new ApiError('Vorgang abgebrochen.', 'abgebrochen'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

const between = (min: number, max: number) => min + Math.random() * (max - min)

const DEFAULT_PROFILE: Profile = { language: 'de', ageGroup: '25–34', interests: [] }

function readUser(): User | null {
  const user = readJson<User | null>(KEYS.user, null)
  if (!user || typeof user.id !== 'string' || typeof user.pseudonym !== 'string') return null
  // Defensive Migration: fehlende Felder auffüllen statt die App crashen lassen.
  const verified = Boolean(user.verified)
  return {
    ...user,
    verified,
    // Ältere Datensätze kannten den Status noch nicht.
    verificationStatus: user.verificationStatus ?? (verified ? 'verifiziert' : 'offen'),
    verifiedAt: user.verifiedAt ?? null,
    phone: user.phone ?? null,
    profile: { ...DEFAULT_PROFILE, ...(user.profile ?? {}) },
  }
}

function persistUser(user: User): User {
  writeJson(KEYS.user, user)
  return user
}

/* ------------------------------------------------------------------ Session */

export async function getSession(): Promise<Session> {
  await delay(between(120, 260))
  return {
    user: readUser(),
    storageAvailable: isStorageAvailable(),
    codexAccepted: readJson<boolean>(KEYS.codex, false) === true,
    selfBlocked: readJson<string[]>(KEYS.selfBlocked, []),
  }
}

/** Verhaltenskodex bestätigen – einmalig vor dem ersten Chat. */
export async function acceptCodex(): Promise<void> {
  await delay(between(120, 240))
  writeJson(KEYS.codex, true)
}

/**
 * Persönliche Blockierung ohne Meldung: betrifft nur das eigene Matching
 * und ist damit etwas anderes als eine Sperre durch die Moderation.
 */
export async function blockPartner(partnerId: string): Promise<string[]> {
  await delay(between(150, 300))
  const list = new Set(readJson<string[]>(KEYS.selfBlocked, []))
  list.add(partnerId)
  const next = [...list]
  writeJson(KEYS.selfBlocked, next)
  return next
}

export async function listSelfBlocked(): Promise<string[]> {
  await delay(between(100, 200))
  return readJson<string[]>(KEYS.selfBlocked, [])
}

export async function clearSelfBlocked(): Promise<void> {
  await delay(between(150, 300))
  remove(KEYS.selfBlocked)
}

/* ------------------------------------------------------- Verifizierung (SMS) */

const CODE_GUELTIG_MS = 10 * 60 * 1000
const MAX_CODE_VERSUCHE = 3

interface SmsState {
  phone: string
  code: string
  expiresAt: number
  attempts: number
}

/** Sehr grosszügige Prüfung – Formate unterscheiden sich pro Land. */
export function normalizePhone(input: string): string | null {
  const roh = input.replace(/[\s/.-]/g, '')
  if (/^0\d{9}$/.test(roh)) return `+41${roh.slice(1)}` // CH-Mobilnummer ohne Vorwahl
  if (/^\+\d{9,15}$/.test(roh)) return roh
  return null
}

export function maskPhone(phone: string): string {
  const sichtbar = phone.slice(-2)
  const prefix = phone.slice(0, 3)
  return `${prefix} •• ••• •• ${sichtbar}`
}

/**
 * Verschickt den SMS-Code.
 *
 * Im Prototyp geht keine SMS raus – der Code wird zurückgegeben und im UI
 * angezeigt. In Phase 2 übernimmt das ein SMS-Gateway, und der Code verlässt
 * den Server nie.
 */
export async function requestSmsCode(input: string): Promise<{ phone: string; code: string; expiresAt: number }> {
  const phone = normalizePhone(input)
  if (!phone) {
    throw new ApiError('Diese Nummer sieht nicht nach einer Mobilnummer aus (z.B. 079 123 45 67).', 'ungueltig')
  }
  await delay(between(700, 1400))

  const state: SmsState = {
    phone,
    code: String(Math.floor(100000 + Math.random() * 900000)),
    expiresAt: Date.now() + CODE_GUELTIG_MS,
    attempts: 0,
  }
  if (!writeJson(KEYS.sms, state)) {
    throw new ApiError('Der Code konnte nicht hinterlegt werden.', 'speicher')
  }
  return { phone, code: state.code, expiresAt: state.expiresAt }
}

export async function confirmSmsCode(input: string): Promise<string> {
  await delay(between(400, 900))
  const state = readJson<SmsState | null>(KEYS.sms, null)
  if (!state) throw new ApiError('Kein Code angefordert.', 'ungueltig')
  if (Date.now() > state.expiresAt) {
    remove(KEYS.sms)
    throw new ApiError('Der Code ist abgelaufen. Bitte einen neuen anfordern.', 'ungueltig')
  }
  if (state.attempts >= MAX_CODE_VERSUCHE) {
    remove(KEYS.sms)
    throw new ApiError('Zu viele Fehlversuche. Bitte einen neuen Code anfordern.', 'ungueltig')
  }
  if (input.replace(/\s/g, '') !== state.code) {
    writeJson(KEYS.sms, { ...state, attempts: state.attempts + 1 })
    const offen = MAX_CODE_VERSUCHE - state.attempts - 1
    throw new ApiError(
      offen > 0 ? `Code stimmt nicht. Noch ${offen} Versuch${offen === 1 ? '' : 'e'}.` : 'Code stimmt nicht.',
      'ungueltig',
    )
  }
  remove(KEYS.sms)
  return state.phone
}

/* ---------------------------------------------- Verifizierung (Einreichung) */

const previewKey = (requestId: string, kind: 'ausweis' | 'selfie') => `${KEYS.preview}${requestId}.${kind}`

function readRequests(): VerificationRequest[] {
  return readJson<VerificationRequest[]>(KEYS.requests, []).filter((r) => r && typeof r.id === 'string')
}

export interface VerificationInput {
  phone: string
  ausweis: { dataUrl: string; meta: UploadMeta }
  selfie: { dataUrl: string; meta: UploadMeta }
}

/**
 * Reicht den Antrag zur manuellen Prüfung ein.
 *
 * Die Bildvorschauen landen im Sitzungsspeicher, die Antragsdaten ohne Bilder
 * in localStorage. Freigeben kann nur die Moderation – hier passiert nichts
 * automatisch.
 */
export async function submitVerification(input: VerificationInput): Promise<VerificationRequest> {
  await delay(between(900, 1600))

  const existing = readUser()
  const user: User = existing ?? {
    id: generateId('usr'),
    pseudonym: generatePseudonym(),
    verified: false,
    verificationStatus: 'offen',
    verifiedAt: null,
    phone: null,
    profile: { ...DEFAULT_PROFILE },
  }

  const request: VerificationRequest = {
    id: generateId('ver'),
    userId: user.id,
    pseudonym: user.pseudonym,
    phoneMasked: maskPhone(input.phone),
    submittedAt: new Date().toISOString(),
    status: 'wartet',
    decidedAt: null,
    decidedBy: null,
    rejectionReason: null,
    documents: { ausweis: input.ausweis.meta, selfie: input.selfie.meta },
  }

  // Ältere Anträge derselben Person werden ersetzt, nicht angehäuft.
  const andere = readRequests().filter((r) => r.userId !== user.id)
  if (!writeJson(KEYS.requests, [request, ...andere])) {
    throw new ApiError('Der Antrag konnte nicht gespeichert werden.', 'speicher')
  }

  writeSessionString(previewKey(request.id, 'ausweis'), input.ausweis.dataUrl)
  writeSessionString(previewKey(request.id, 'selfie'), input.selfie.dataUrl)

  persistUser({ ...user, phone: input.phone, verified: false, verificationStatus: 'wartet' })
  return request
}

/** Antrag der eigenen Person, sofern vorhanden. */
export async function getMyVerification(): Promise<VerificationRequest | null> {
  await delay(between(150, 320))
  const user = readUser()
  if (!user) return null
  return readRequests().find((r) => r.userId === user.id) ?? null
}

export async function listVerificationRequests(): Promise<VerificationRequest[]> {
  await delay(between(150, 350))
  return readRequests()
}

/** Bildvorschauen zu einem Antrag – nach Browserneustart nicht mehr da. */
export async function getVerificationImages(requestId: string): Promise<VerificationImages> {
  await delay(between(80, 180))
  return {
    ausweis: readSessionString(previewKey(requestId, 'ausweis')),
    selfie: readSessionString(previewKey(requestId, 'selfie')),
  }
}

/**
 * Entscheid der Moderation. Das ist der einzige Weg zu "verifiziert" – es gibt
 * keine automatische Freigabe.
 */
export async function decideVerification(
  requestId: string,
  decision: 'freigegeben' | 'abgelehnt',
  rejectionReason?: string,
): Promise<VerificationRequest[]> {
  await delay(between(400, 800))
  const requests = readRequests()
  const request = requests.find((r) => r.id === requestId)
  if (!request) throw new ApiError('Antrag nicht gefunden.', 'ungueltig')

  const aktualisiert: VerificationRequest = {
    ...request,
    status: decision,
    decidedAt: new Date().toISOString(),
    decidedBy: 'Moderation (Demo)',
    rejectionReason: decision === 'abgelehnt' ? (rejectionReason?.trim() || 'Ohne Angabe') : null,
  }
  const next = requests.map((r) => (r.id === requestId ? aktualisiert : r))
  if (!writeJson(KEYS.requests, next)) {
    throw new ApiError('Der Entscheid konnte nicht gespeichert werden.', 'speicher')
  }

  // Nach dem Entscheid werden die Bilder verworfen – die Prüfung ist vorbei.
  removeSession(previewKey(requestId, 'ausweis'))
  removeSession(previewKey(requestId, 'selfie'))

  const user = readUser()
  if (user && user.id === request.userId) {
    persistUser({
      ...user,
      verified: decision === 'freigegeben',
      verificationStatus: decision === 'freigegeben' ? 'verifiziert' : 'abgelehnt',
      verifiedAt: decision === 'freigegeben' ? aktualisiert.decidedAt : null,
    })
  }
  return next
}

/** Nach einer Ablehnung neu einreichen: alten Antrag verwerfen. */
export async function withdrawVerification(): Promise<void> {
  await delay(between(150, 300))
  const user = readUser()
  if (!user) return
  const rest = readRequests().filter((r) => r.userId !== user.id)
  writeJson(KEYS.requests, rest)
  persistUser({ ...user, verified: false, verificationStatus: 'offen', verifiedAt: null })
}

export async function updateProfile(profile: Profile): Promise<User> {
  await delay(between(200, 450))
  const user = readUser()
  if (!user) throw new ApiError('Keine verifizierte Identität vorhanden.', 'nicht-verifiziert')
  return persistUser({ ...user, profile })
}

export async function regeneratePseudonym(): Promise<User> {
  await delay(between(200, 400))
  const user = readUser()
  if (!user) throw new ApiError('Keine verifizierte Identität vorhanden.', 'nicht-verifiziert')
  return persistUser({ ...user, pseudonym: generatePseudonym() })
}

/** Nur für die Demo: setzt Identität und Verifizierung zurück. */
export async function resetIdentity(): Promise<void> {
  await delay(between(150, 300))
  const user = readUser()
  if (user) {
    for (const request of readRequests().filter((r) => r.userId === user.id)) {
      removeSession(previewKey(request.id, 'ausweis'))
      removeSession(previewKey(request.id, 'selfie'))
    }
    writeJson(KEYS.requests, readRequests().filter((r) => r.userId !== user.id))
  }
  remove(KEYS.user)
  remove(KEYS.codex)
  remove(KEYS.selfBlocked)
  remove(KEYS.sms)
}

/* ----------------------------------------------------------------- Matching */

export async function findMatch(filter: MatchFilter, signal?: AbortSignal): Promise<Partner> {
  await delay(between(1000, 3000), signal)

  // Gesperrt durch die Moderation oder selbst blockiert – beides schliesst aus.
  const blocked = new Set([
    ...readJson<string[]>(KEYS.blocked, []),
    ...readJson<string[]>(KEYS.selfBlocked, []),
  ])
  const candidates = PARTNER_POOL.filter((partner) => {
    if (blocked.has(partner.id)) return false
    if (filter.language !== 'egal' && partner.language !== filter.language) return false
    if (filter.interests.length > 0 && !filter.interests.some((i) => partner.interests.includes(i))) return false
    return true
  })

  if (candidates.length === 0) {
    throw new ApiError('Gerade niemand passendes erreichbar.', 'kein-treffer')
  }
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/* --------------------------------------------------------------------- Chat */

/** Lokaler Wortfilter – markiert, blockiert nicht. */
export function scanMessage(text: string): FilterVerdict | null {
  return scanText(text)
}

export interface PartnerUtterance {
  text: string
  /** Wie lange der Tippindikator vorher laufen soll. */
  typingMs: number
}

export async function requestOpener(
  partner: Partner,
  ownInterests: string[],
  signal?: AbortSignal,
): Promise<PartnerUtterance> {
  await delay(between(600, 1400), signal)
  const shared = partner.interests.filter((i) => ownInterests.includes(i))
  const text = openerFor(shared)
  return { text, typingMs: typingDurationFor(text) }
}

export async function requestReply(
  partner: Partner,
  history: Message[],
  turn: number,
  signal?: AbortSignal,
): Promise<PartnerUtterance> {
  await delay(between(500, 1200), signal)
  const text = replyFor(partner, history, turn)
  return { text, typingMs: typingDurationFor(text) }
}


/* ------------------------------------------- Chatverlauf (72-Stunden-Puffer) */

/**
 * Aufbewahrungsfrist für Chatverläufe.
 *
 * Verläufe werden zur Missbrauchsprüfung vorgehalten und danach gelöscht.
 * Die Frist ist die einzige Bremse gegen einen wachsenden Datenberg – sie
 * wird bei jedem Lesezugriff durchgesetzt, nicht nur beim Schreiben, damit
 * abgelaufene Verläufe auch dann verschwinden, wenn die App tagelang nicht
 * offen war.
 */
export const RETENTION_MS = 72 * 60 * 60 * 1000

function pruneTranscripts(list: ChatTranscript[]): ChatTranscript[] {
  const jetzt = Date.now()
  return list.filter((t) => t && typeof t.id === 'string' && t.expiresAt > jetzt)
}

function readTranscripts(): ChatTranscript[] {
  const alle = readJson<ChatTranscript[]>(KEYS.transcripts, [])
  const gueltig = pruneTranscripts(alle)
  if (gueltig.length !== alle.length) writeJson(KEYS.transcripts, gueltig)
  return gueltig
}

function logAccess(transcriptId: string, action: AccessLogEntry['action']): void {
  const eintrag: AccessLogEntry = {
    id: generateId('log'),
    at: new Date().toISOString(),
    transcriptId,
    by: 'Moderation (Demo)',
    action,
  }
  const bisher = readJson<AccessLogEntry[]>(KEYS.accessLog, [])
  writeJson(KEYS.accessLog, [eintrag, ...bisher].slice(0, 200))
}

export interface TranscriptInput {
  owner: User
  partner: Partner
  messages: Message[]
}

/** Legt den Verlauf eines beendeten Chats in den Moderationsspeicher. */
export async function saveTranscript(input: TranscriptInput): Promise<ChatTranscript | null> {
  const relevant: TranscriptMessage[] = input.messages
    .filter((m): m is Message & { author: 'me' | 'partner' } => m.author !== 'system')
    .map(({ author, text, ts, flag }) => ({ author, text, ts, flag }))

  // Ein Chat ohne Wortwechsel hat nichts, was eine Aufbewahrung rechtfertigt.
  if (relevant.length === 0) return null

  await delay(between(150, 320))

  const transcript: ChatTranscript = {
    id: generateId('chat'),
    ownerId: input.owner.id,
    ownerPseudonym: input.owner.pseudonym,
    partnerId: input.partner.id,
    partnerPseudonym: input.partner.pseudonym,
    startedAt: new Date(relevant[0].ts).toISOString(),
    endedAt: new Date().toISOString(),
    expiresAt: Date.now() + RETENTION_MS,
    messages: relevant,
    flagCount: relevant.filter((m) => m.flag).length,
    reported: false,
  }

  const bisher = readTranscripts()
  if (!writeJson(KEYS.transcripts, [transcript, ...bisher])) return null
  return transcript
}

/** Übersicht für die Moderation – ohne Zugriffseintrag, das ist noch kein Mitlesen. */
export async function listTranscripts(): Promise<ChatTranscript[]> {
  await delay(between(150, 320))
  return readTranscripts()
}

/** Öffnet einen Verlauf. Das ist Mitlesen und wird protokolliert. */
export async function openTranscript(id: string): Promise<ChatTranscript | null> {
  await delay(between(150, 320))
  const transcript = readTranscripts().find((t) => t.id === id) ?? null
  if (transcript) logAccess(id, 'geoeffnet')
  return transcript
}

export async function deleteTranscript(id: string): Promise<ChatTranscript[]> {
  await delay(between(150, 320))
  const rest = readTranscripts().filter((t) => t.id !== id)
  writeJson(KEYS.transcripts, rest)
  logAccess(id, 'geloescht')
  return rest
}

export async function listAccessLog(): Promise<AccessLogEntry[]> {
  await delay(between(100, 200))
  return readJson<AccessLogEntry[]>(KEYS.accessLog, [])
}

/** Markiert den Verlauf, zu dem eine Meldung eingegangen ist. */
function markReported(transcriptId: string | null): void {
  if (!transcriptId) return
  const alle = readTranscripts()
  writeJson(
    KEYS.transcripts,
    alle.map((t) => (t.id === transcriptId ? { ...t, reported: true } : t)),
  )
}

/* --------------------------------------------------------------- Moderation */

const EXCERPT_LENGTH = 8
/** Obergrenze, damit der lokale Speicher nicht unbegrenzt volläuft. */
const MAX_REPORTS = 200

export async function submitReport(input: ReportInput, reporter: User): Promise<Report> {
  await delay(between(500, 900))
  markReported(input.transcriptId ?? null)

  const report: Report = {
    id: generateId('rep'),
    createdAt: new Date().toISOString(),
    reporterId: reporter.id,
    reporterPseudonym: reporter.pseudonym,
    reportedId: input.partner.id,
    reportedPseudonym: input.partner.pseudonym,
    reason: input.reason,
    note: input.note.trim().slice(0, 1000),
    excerpt: input.messages
      .filter((m) => m.author !== 'system')
      .slice(-EXCERPT_LENGTH)
      .map(({ author, text, ts }) => ({ author, text, ts })),
    // Nur Treffer des gemeldeten Kontos – eigene markierte Nachrichten
    // sind keine Belastung des Gegenübers.
    autoFlags: input.messages.filter((m) => m.author === 'partner' && m.flag).length,
    transcriptId: input.transcriptId ?? null,
    status: 'offen',
  }

  // Wer meldet, will dem Konto in aller Regel nicht gleich wieder begegnen.
  const selfBlocked = new Set(readJson<string[]>(KEYS.selfBlocked, []))
  selfBlocked.add(input.partner.id)
  writeJson(KEYS.selfBlocked, [...selfBlocked])

  const reports = readJson<Report[]>(KEYS.reports, [])
  if (!writeJson(KEYS.reports, [report, ...reports].slice(0, MAX_REPORTS))) {
    // Lieber ein ehrlicher Fehler als eine Vorgangsnummer für eine Meldung,
    // die nirgends liegt.
    throw new ApiError('Die Meldung konnte nicht gespeichert werden.', 'speicher')
  }
  return report
}

export async function listReports(): Promise<Report[]> {
  await delay(between(150, 350))
  return readJson<Report[]>(KEYS.reports, []).filter((r) => r && typeof r.id === 'string')
}

export async function updateReportStatus(id: string, status: ReportStatus): Promise<Report[]> {
  await delay(between(200, 400))
  const reports = readJson<Report[]>(KEYS.reports, [])
  const next = reports.map((report) => (report.id === id ? { ...report, status } : report))
  writeJson(KEYS.reports, next)

  // Sperren wirken sofort auf das Matching: gesperrte Konten tauchen nicht
  // mehr im Pool auf. Weil die Identität verifiziert ist, kann sich dahinter
  // in Phase 2 auch kein neues Konto verstecken.
  //
  // Die Sperrliste wird aus allen Meldungen neu berechnet: ein Konto bleibt
  // gesperrt, solange auch nur eine Meldung dagegen auf "gesperrt" steht.
  const blocked = [...new Set(next.filter((r) => r.status === 'gesperrt').map((r) => r.reportedId))]
  writeJson(KEYS.blocked, blocked)
  return next
}

export async function listBlocked(): Promise<string[]> {
  await delay(between(100, 200))
  return readJson<string[]>(KEYS.blocked, [])
}

export async function clearReports(): Promise<void> {
  await delay(between(200, 400))
  remove(KEYS.reports)
  remove(KEYS.blocked)
  remove(KEYS.transcripts)
  remove(KEYS.accessLog)
}

/** Nur für die Demo: setzt Kodex-Bestätigung und eigene Blockierungen zurück. */
export async function resetLocalPreferences(): Promise<void> {
  await delay(between(120, 240))
  remove(KEYS.codex)
  remove(KEYS.selfBlocked)
}
