import { KEYS, isStorageAvailable, readJson, remove, writeJson } from './storage'
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
  Session,
  User,
  VerificationStage,
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

export type ApiErrorCode = 'abgebrochen' | 'kein-treffer' | 'nicht-verifiziert' | 'ungueltig'

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
  return {
    ...user,
    verified: Boolean(user.verified),
    verifiedAt: user.verifiedAt ?? null,
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
  return { user: readUser(), storageAvailable: isStorageAvailable() }
}

/**
 * Nimmt das "Ausweisdokument" entgegen.
 *
 * Die Datei wird bewusst WEDER gelesen NOCH gespeichert NOCH übertragen –
 * geprüft wird nur, dass überhaupt etwas ausgewählt wurde. In Phase 2
 * übernimmt ein externer Anbieter (z.B. Veriff/Sumsub) diesen Schritt
 * vollständig; die Datei darf dieses Gerät dann direkt Richtung Anbieter
 * verlassen, nie über unseren Server.
 */
export async function submitDocument(file: File | null, signal?: AbortSignal): Promise<void> {
  if (!file) throw new ApiError('Bitte zuerst ein Dokument auswählen.', 'ungueltig')
  await delay(between(900, 1500), signal)
}

/** Simulierter Liveness-Check; meldet Zwischenstände an die UI. */
export async function runLivenessCheck(
  onStage: (stage: VerificationStage) => void,
  signal?: AbortSignal,
): Promise<void> {
  onStage('liveness')
  await delay(between(1400, 2200), signal)
  onStage('abgleich')
  await delay(between(900, 1600), signal)
}

/** Schliesst die Verifizierung ab und legt die Identität an. */
export async function completeVerification(signal?: AbortSignal): Promise<User> {
  await delay(between(300, 600), signal)
  const existing = readUser()
  const user: User = existing
    ? { ...existing, verified: true, verifiedAt: new Date().toISOString() }
    : {
        id: generateId('usr'),
        pseudonym: generatePseudonym(),
        verified: true,
        verifiedAt: new Date().toISOString(),
        profile: { ...DEFAULT_PROFILE },
      }
  return persistUser(user)
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
  remove(KEYS.user)
}

/* ----------------------------------------------------------------- Matching */

export async function findMatch(filter: MatchFilter, signal?: AbortSignal): Promise<Partner> {
  await delay(between(1000, 3000), signal)

  const blocked = new Set(readJson<string[]>(KEYS.blocked, []))
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

/* --------------------------------------------------------------- Moderation */

const EXCERPT_LENGTH = 8

export async function submitReport(input: ReportInput, reporter: User): Promise<Report> {
  await delay(between(500, 900))

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
    autoFlags: input.messages.filter((m) => m.flag).length,
    status: 'offen',
  }

  const reports = readJson<Report[]>(KEYS.reports, [])
  writeJson(KEYS.reports, [report, ...reports])
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
  const blocked = new Set(readJson<string[]>(KEYS.blocked, []))
  const report = next.find((r) => r.id === id)
  if (report) {
    if (status === 'gesperrt') blocked.add(report.reportedId)
    else blocked.delete(report.reportedId)
    writeJson(KEYS.blocked, [...blocked])
  }
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
}
