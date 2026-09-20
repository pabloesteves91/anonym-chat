import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage'
import { getDb, getFileStorage, getFirebaseAuth } from '../firebase'
import { generateId, generatePseudonym } from '../pseudonym'
import { PARTNER_POOL } from '../partnerScript'
import { validateDisplayName } from '../wordFilter'
import { ApiError, EXCERPT_LENGTH, RETENTION_MS, between, delay, maskPhone } from './shared'
import type {
  AccessLogEntry,
  ChatTranscript,
  MatchFilter,
  Partner,
  Profile,
  Report,
  ReportInput,
  ReportStatus,
  Session,
  TranscriptMessage,
  User,
  VerificationImages,
  VerificationRequest,
} from '../types'

export { ApiError, RETENTION_MS, maskPhone, normalizePhone } from './shared'
export type { ApiErrorCode } from './shared'

// Simulierte Gesprächspartner und der Wortfilter bleiben lokal: Sie sind
// Attrappen beziehungsweise reine Rechnerei ohne Datenhaltung.
export { requestOpener, requestReply, scanMessage, requestSmsCode, confirmSmsCode } from './local'
export type { PartnerUtterance, VerificationInput, TranscriptInput } from './local'

/**
 * Datenquelle Firestore.
 *
 * Dieselben Funktionen wie die lokale Variante, nur liegen die Daten auf dem
 * Server: Die Moderation sieht damit Anträge, Meldungen und Verläufe aller
 * Konten, nicht nur die des eigenen Browsers.
 *
 * Was hier steht, ist nur die halbe Miete – durchgesetzt wird der Zugriff von
 * `firestore.rules` und `storage.rules`. Eine abgewiesene Regel kommt als
 * `ApiError` mit dem Code 'verweigert' zurück.
 */

const PFAD = {
  users: 'users',
  verifications: 'verifications',
  reports: 'reports',
  chats: 'chats',
  blocked: 'blocked',
  accessLog: 'accessLog',
} as const

const DEFAULT_PROFILE: Profile = { language: 'de', ageGroup: '25–34', interests: [] }

function uid(): string {
  const id = getFirebaseAuth().currentUser?.uid
  if (!id) throw new ApiError('Nicht angemeldet.', 'nicht-verifiziert')
  return id
}

/** Firestore-Fehler in die Sprache der App übersetzen. */
function uebersetze(error: unknown, fallback: string): ApiError {
  if (error instanceof ApiError) return error
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code.includes('permission-denied')) {
    return new ApiError('Dafür fehlen die Rechte.', 'verweigert')
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return new ApiError('Keine Verbindung zur Datenbank.', 'speicher')
  }
  return new ApiError(fallback, 'speicher')
}

async function fuehreAus<T>(was: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await was()
  } catch (error) {
    throw uebersetze(error, fallback)
  }
}

/* ------------------------------------------------------------- Identität */

interface UserDoc {
  pseudonym: string
  verified: boolean
  verificationStatus: User['verificationStatus']
  verifiedAt: string | null
  phone: string | null
  profile: Profile
  codexAccepted: boolean
  selfBlocked: string[]
}

const leererUser = (): UserDoc => ({
  pseudonym: generatePseudonym(),
  verified: false,
  verificationStatus: 'offen',
  verifiedAt: null,
  phone: null,
  profile: { ...DEFAULT_PROFILE },
  codexAccepted: false,
  selfBlocked: [],
})

function toUser(id: string, data: UserDoc): User {
  return {
    id,
    pseudonym: data.pseudonym,
    verified: Boolean(data.verified),
    verificationStatus: data.verificationStatus ?? 'offen',
    verifiedAt: data.verifiedAt ?? null,
    phone: data.phone ?? null,
    profile: { ...DEFAULT_PROFILE, ...(data.profile ?? {}) },
  }
}

async function ladeUserDoc(id: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(getDb(), PFAD.users, id))
  return snap.exists() ? (snap.data() as UserDoc) : null
}

export async function ensureIdentity(id: string): Promise<User> {
  return fuehreAus(async () => {
    const vorhanden = await ladeUserDoc(id)
    if (vorhanden) return toUser(id, vorhanden)
    const neu = leererUser()
    await setDoc(doc(getDb(), PFAD.users, id), neu)
    return toUser(id, neu)
  }, 'Konto konnte nicht angelegt werden.')
}

export async function getSession(): Promise<Session> {
  const id = getFirebaseAuth().currentUser?.uid
  if (!id) return { user: null, storageAvailable: true, codexAccepted: false, selfBlocked: [] }

  return fuehreAus(async () => {
    const data = await ladeUserDoc(id)
    return {
      user: data ? toUser(id, data) : null,
      storageAvailable: true,
      codexAccepted: Boolean(data?.codexAccepted),
      selfBlocked: data?.selfBlocked ?? [],
    }
  }, 'Konto konnte nicht geladen werden.')
}

export async function acceptCodex(): Promise<void> {
  await fuehreAus(
    () => updateDoc(doc(getDb(), PFAD.users, uid()), { codexAccepted: true }),
    'Bestätigung konnte nicht gespeichert werden.',
  )
}

export async function blockPartner(partnerId: string): Promise<string[]> {
  return fuehreAus(async () => {
    const id = uid()
    const data = await ladeUserDoc(id)
    const liste = new Set(data?.selfBlocked ?? [])
    liste.add(partnerId)
    const next = [...liste]
    await updateDoc(doc(getDb(), PFAD.users, id), { selfBlocked: next })
    return next
  }, 'Blockierung konnte nicht gespeichert werden.')
}

export async function listSelfBlocked(): Promise<string[]> {
  return fuehreAus(async () => (await ladeUserDoc(uid()))?.selfBlocked ?? [], 'Liste nicht lesbar.')
}

export async function clearSelfBlocked(): Promise<void> {
  await fuehreAus(
    () => updateDoc(doc(getDb(), PFAD.users, uid()), { selfBlocked: [] }),
    'Blockierungen konnten nicht aufgehoben werden.',
  )
}

export async function updateProfile(profile: Profile): Promise<User> {
  return fuehreAus(async () => {
    const id = uid()
    await updateDoc(doc(getDb(), PFAD.users, id), { profile })
    const data = await ladeUserDoc(id)
    if (!data) throw new ApiError('Keine Identität vorhanden.', 'nicht-verifiziert')
    return toUser(id, data)
  }, 'Profil konnte nicht gespeichert werden.')
}

async function setzePseudonym(name: string): Promise<User> {
  const id = uid()
  await updateDoc(doc(getDb(), PFAD.users, id), { pseudonym: name })
  const data = await ladeUserDoc(id)
  if (!data) throw new ApiError('Keine Identität vorhanden.', 'nicht-verifiziert')
  return toUser(id, data)
}

export async function setPseudonym(name: string): Promise<User> {
  const pruefung = validateDisplayName(name)
  if (!pruefung.ok) throw new ApiError(pruefung.error ?? 'Dieser Name geht nicht.', 'ungueltig')
  return fuehreAus(() => setzePseudonym(name.trim()), 'Name konnte nicht gespeichert werden.')
}

export async function regeneratePseudonym(): Promise<User> {
  return fuehreAus(() => setzePseudonym(generatePseudonym()), 'Name konnte nicht gewürfelt werden.')
}

/* ---------------------------------------------------------- Verifizierung */

const bildPfad = (userId: string, art: 'ausweis' | 'selfie') => `${PFAD.verifications}/${userId}/${art}.jpg`

interface VerificationDoc extends Omit<VerificationRequest, 'submittedAt' | 'decidedAt'> {
  submittedAt: Timestamp
  decidedAt: Timestamp | null
}

function toRequest(id: string, data: VerificationDoc): VerificationRequest {
  return {
    ...data,
    id,
    submittedAt: data.submittedAt?.toDate().toISOString() ?? new Date().toISOString(),
    decidedAt: data.decidedAt?.toDate().toISOString() ?? null,
  }
}

export async function submitVerification(input: {
  phone: string
  ausweis: { dataUrl: string; meta: { name: string; size: number; type: string } }
  selfie: { dataUrl: string; meta: { name: string; size: number; type: string } }
}): Promise<VerificationRequest> {
  return fuehreAus(async () => {
    const id = uid()
    const data = (await ladeUserDoc(id)) ?? leererUser()

    // Bilder zuerst: ohne sie ist ein Antrag nutzlos.
    await uploadString(ref(getFileStorage(), bildPfad(id, 'ausweis')), input.ausweis.dataUrl, 'data_url')
    await uploadString(ref(getFileStorage(), bildPfad(id, 'selfie')), input.selfie.dataUrl, 'data_url')

    const requestId = generateId('ver')
    const antrag: VerificationDoc = {
      id: requestId,
      userId: id,
      pseudonym: data.pseudonym,
      phoneMasked: maskPhone(input.phone),
      submittedAt: Timestamp.now(),
      status: 'wartet',
      decidedAt: null,
      decidedBy: null,
      rejectionReason: null,
      documents: { ausweis: input.ausweis.meta, selfie: input.selfie.meta },
    }

    // Ältere Anträge derselben Person ersetzen, nicht anhäufen.
    const alte = await getDocs(query(collection(getDb(), PFAD.verifications), where('userId', '==', id)))
    const stapel = writeBatch(getDb())
    alte.forEach((eintrag) => stapel.delete(eintrag.ref))
    stapel.set(doc(getDb(), PFAD.verifications, requestId), antrag)
    stapel.update(doc(getDb(), PFAD.users, id), {
      phone: input.phone,
      verified: false,
      verificationStatus: 'wartet',
    })
    await stapel.commit()

    return toRequest(requestId, antrag)
  }, 'Antrag konnte nicht eingereicht werden.')
}

export async function getMyVerification(): Promise<VerificationRequest | null> {
  const id = getFirebaseAuth().currentUser?.uid
  if (!id) return null
  return fuehreAus(async () => {
    const treffer = await getDocs(query(collection(getDb(), PFAD.verifications), where('userId', '==', id)))
    const erster = treffer.docs[0]
    return erster ? toRequest(erster.id, erster.data() as VerificationDoc) : null
  }, 'Antrag nicht lesbar.')
}

export async function listVerificationRequests(): Promise<VerificationRequest[]> {
  return fuehreAus(async () => {
    const treffer = await getDocs(query(collection(getDb(), PFAD.verifications), orderBy('submittedAt', 'desc')))
    return treffer.docs.map((eintrag) => toRequest(eintrag.id, eintrag.data() as VerificationDoc))
  }, 'Anträge nicht lesbar.')
}

export async function getVerificationImages(requestId: string): Promise<VerificationImages> {
  const antrag = await fuehreAus(async () => {
    const snap = await getDoc(doc(getDb(), PFAD.verifications, requestId))
    return snap.exists() ? (snap.data() as VerificationDoc) : null
  }, 'Antrag nicht lesbar.')
  if (!antrag) return { ausweis: null, selfie: null }

  const hole = async (art: 'ausweis' | 'selfie') => {
    try {
      return await getDownloadURL(ref(getFileStorage(), bildPfad(antrag.userId, art)))
    } catch {
      // Nach dem Entscheid sind die Bilder gelöscht – das ist kein Fehler.
      return null
    }
  }
  return { ausweis: await hole('ausweis'), selfie: await hole('selfie') }
}

export async function decideVerification(
  requestId: string,
  decision: 'freigegeben' | 'abgelehnt',
  rejectionReason?: string,
): Promise<VerificationRequest[]> {
  return fuehreAus(async () => {
    const snap = await getDoc(doc(getDb(), PFAD.verifications, requestId))
    if (!snap.exists()) throw new ApiError('Antrag nicht gefunden.', 'ungueltig')
    const antrag = snap.data() as VerificationDoc
    const entschiedenAm = Timestamp.now()

    const stapel = writeBatch(getDb())
    stapel.update(doc(getDb(), PFAD.verifications, requestId), {
      status: decision,
      decidedAt: entschiedenAm,
      decidedBy: getFirebaseAuth().currentUser?.email ?? 'Moderation',
      rejectionReason: decision === 'abgelehnt' ? (rejectionReason?.trim() || 'Ohne Angabe') : null,
    })
    stapel.update(doc(getDb(), PFAD.users, antrag.userId), {
      verified: decision === 'freigegeben',
      verificationStatus: decision === 'freigegeben' ? 'verifiziert' : 'abgelehnt',
      verifiedAt: decision === 'freigegeben' ? entschiedenAm.toDate().toISOString() : null,
    })
    await stapel.commit()

    // Nach dem Entscheid werden die Bilder gelöscht – die Prüfung ist vorbei.
    for (const art of ['ausweis', 'selfie'] as const) {
      try {
        await deleteObject(ref(getFileStorage(), bildPfad(antrag.userId, art)))
      } catch {
        /* schon weg */
      }
    }

    return await listVerificationRequests()
  }, 'Entscheid konnte nicht gespeichert werden.')
}

export async function withdrawVerification(): Promise<void> {
  await fuehreAus(async () => {
    const id = uid()
    const treffer = await getDocs(query(collection(getDb(), PFAD.verifications), where('userId', '==', id)))
    const stapel = writeBatch(getDb())
    treffer.forEach((eintrag) => stapel.delete(eintrag.ref))
    stapel.update(doc(getDb(), PFAD.users, id), {
      verified: false,
      verificationStatus: 'offen',
      verifiedAt: null,
    })
    await stapel.commit()
    for (const art of ['ausweis', 'selfie'] as const) {
      try {
        await deleteObject(ref(getFileStorage(), bildPfad(id, art)))
      } catch {
        /* schon weg */
      }
    }
  }, 'Antrag konnte nicht zurückgezogen werden.')
}

/** TESTHILFE – wie in der lokalen Variante, siehe dort. */
export async function overrideVerificationForTesting(verified: boolean): Promise<User> {
  return fuehreAus(async () => {
    const id = uid()
    await updateDoc(doc(getDb(), PFAD.users, id), {
      verified,
      verificationStatus: verified ? 'verifiziert' : 'offen',
      verifiedAt: verified ? new Date().toISOString() : null,
    })
    const data = await ladeUserDoc(id)
    if (!data) throw new ApiError('Keine Identität vorhanden.', 'nicht-verifiziert')
    return toUser(id, data)
  }, 'Status konnte nicht gesetzt werden.')
}

export async function resetIdentity(): Promise<void> {
  await fuehreAus(async () => {
    const id = uid()
    await withdrawVerification()
    await setDoc(doc(getDb(), PFAD.users, id), leererUser())
  }, 'Zurücksetzen fehlgeschlagen.')
}

export async function resetLocalPreferences(): Promise<void> {
  await fuehreAus(
    () => updateDoc(doc(getDb(), PFAD.users, uid()), { codexAccepted: false, selfBlocked: [] }),
    'Zurücksetzen fehlgeschlagen.',
  )
}

/* -------------------------------------------------------------- Matching */

export async function findMatch(filter: MatchFilter, signal?: AbortSignal): Promise<Partner> {
  await delay(between(1000, 3000), signal)

  const [gesperrt, eigene] = await Promise.all([listBlocked(), listSelfBlocked()])
  const raus = new Set([...gesperrt, ...eigene])

  const kandidaten = PARTNER_POOL.filter((partner) => {
    if (raus.has(partner.id)) return false
    if (filter.language !== 'egal' && partner.language !== filter.language) return false
    if (filter.interests.length > 0 && !filter.interests.some((i) => partner.interests.includes(i))) return false
    return true
  })

  if (kandidaten.length === 0) throw new ApiError('Gerade niemand passendes erreichbar.', 'kein-treffer')
  return kandidaten[Math.floor(Math.random() * kandidaten.length)]
}

/* ----------------------------------------------------------- Chatverläufe */

interface TranscriptDoc extends Omit<ChatTranscript, 'startedAt' | 'endedAt' | 'expiresAt'> {
  startedAt: Timestamp
  endedAt: Timestamp
  /** Feld der TTL-Richtlinie: Firestore löscht das Dokument danach selbst. */
  expiresAt: Timestamp
}

function toTranscript(id: string, data: TranscriptDoc): ChatTranscript {
  return {
    ...data,
    id,
    startedAt: data.startedAt?.toDate().toISOString() ?? new Date().toISOString(),
    endedAt: data.endedAt?.toDate().toISOString() ?? new Date().toISOString(),
    expiresAt: data.expiresAt?.toMillis() ?? 0,
  }
}

export async function saveTranscript(input: {
  owner: User
  partner: Partner
  messages: { author: string; text: string; ts: number; flag?: unknown }[]
}): Promise<ChatTranscript | null> {
  const relevant = input.messages
    .filter((m) => m.author !== 'system')
    .map(({ author, text, ts, flag }) => ({ author, text, ts, ...(flag ? { flag } : {}) })) as TranscriptMessage[]
  if (relevant.length === 0) return null

  return fuehreAus(async () => {
    const id = generateId('chat')
    const transcript: TranscriptDoc = {
      id,
      ownerId: input.owner.id,
      ownerPseudonym: input.owner.pseudonym,
      partnerId: input.partner.id,
      partnerPseudonym: input.partner.pseudonym,
      startedAt: Timestamp.fromMillis(relevant[0].ts),
      endedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS),
      messages: relevant,
      flagCount: relevant.filter((m) => m.flag).length,
      reported: false,
    }
    await setDoc(doc(getDb(), PFAD.chats, id), transcript)
    return toTranscript(id, transcript)
  }, 'Verlauf konnte nicht gespeichert werden.')
}

export async function listTranscripts(): Promise<ChatTranscript[]> {
  return fuehreAus(async () => {
    // Abgelaufene sind durch die Regeln ohnehin nicht lesbar; die Abfrage
    // hält sie zusätzlich fern, bis die TTL-Richtlinie sie entfernt.
    const treffer = await getDocs(
      query(
        collection(getDb(), PFAD.chats),
        where('expiresAt', '>', Timestamp.now()),
        orderBy('expiresAt', 'desc'),
      ),
    )
    return treffer.docs.map((eintrag) => toTranscript(eintrag.id, eintrag.data() as TranscriptDoc))
  }, 'Verläufe nicht lesbar.')
}

async function protokolliere(transcriptId: string, action: AccessLogEntry['action']): Promise<void> {
  const eintrag: AccessLogEntry = {
    id: generateId('log'),
    at: new Date().toISOString(),
    transcriptId,
    by: getFirebaseAuth().currentUser?.email ?? 'Moderation',
    action,
  }
  await setDoc(doc(getDb(), PFAD.accessLog, eintrag.id), eintrag)
}

export async function openTranscript(id: string): Promise<ChatTranscript | null> {
  return fuehreAus(async () => {
    const snap = await getDoc(doc(getDb(), PFAD.chats, id))
    if (!snap.exists()) return null
    await protokolliere(id, 'geoeffnet')
    return toTranscript(id, snap.data() as TranscriptDoc)
  }, 'Verlauf nicht lesbar.')
}

export async function deleteTranscript(id: string): Promise<ChatTranscript[]> {
  return fuehreAus(async () => {
    const snap = await getDoc(doc(getDb(), PFAD.chats, id))
    if (!snap.exists()) return await listTranscripts()
    await deleteDoc(doc(getDb(), PFAD.chats, id))
    await protokolliere(id, 'geloescht')
    return await listTranscripts()
  }, 'Verlauf konnte nicht gelöscht werden.')
}

export async function listAccessLog(): Promise<AccessLogEntry[]> {
  return fuehreAus(async () => {
    const treffer = await getDocs(query(collection(getDb(), PFAD.accessLog), orderBy('at', 'desc')))
    return treffer.docs.map((eintrag) => eintrag.data() as AccessLogEntry)
  }, 'Protokoll nicht lesbar.')
}

/* ------------------------------------------------------------- Meldungen */

export async function submitReport(input: ReportInput & { transcriptId?: string | null }, reporter: User): Promise<Report> {
  return fuehreAus(async () => {
    const id = generateId('rep')
    const report: Report = {
      id,
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
      autoFlags: input.messages.filter((m) => m.author === 'partner' && m.flag).length,
      transcriptId: input.transcriptId ?? null,
      status: 'offen',
    }

    await setDoc(doc(getDb(), PFAD.reports, id), report)

    // Wer meldet, will dem Konto in aller Regel nicht gleich wieder begegnen.
    await blockPartner(input.partner.id)
    if (input.transcriptId) {
      try {
        await updateDoc(doc(getDb(), PFAD.chats, input.transcriptId), { reported: true })
      } catch {
        /* Verlauf schon abgelaufen */
      }
    }
    return report
  }, 'Meldung konnte nicht gespeichert werden.')
}

export async function listReports(): Promise<Report[]> {
  return fuehreAus(async () => {
    const treffer = await getDocs(query(collection(getDb(), PFAD.reports), orderBy('createdAt', 'desc')))
    return treffer.docs.map((eintrag) => eintrag.data() as Report)
  }, 'Meldungen nicht lesbar.')
}

export async function updateReportStatus(id: string, status: ReportStatus): Promise<Report[]> {
  return fuehreAus(async () => {
    await updateDoc(doc(getDb(), PFAD.reports, id), { status })
    const alle = await listReports()

    // Sperrliste aus allen Meldungen neu berechnen: ein Konto bleibt gesperrt,
    // solange auch nur eine Meldung dagegen auf "gesperrt" steht.
    const sollen = new Set(alle.filter((r) => r.status === 'gesperrt').map((r) => r.reportedId))
    const bestehend = await getDocs(collection(getDb(), PFAD.blocked))
    const stapel = writeBatch(getDb())
    bestehend.forEach((eintrag) => {
      if (!sollen.has(eintrag.id)) stapel.delete(eintrag.ref)
      else sollen.delete(eintrag.id)
    })
    sollen.forEach((userId) => {
      stapel.set(doc(getDb(), PFAD.blocked, userId), { at: new Date().toISOString() })
    })
    await stapel.commit()

    return alle
  }, 'Status konnte nicht gesetzt werden.')
}

export async function listBlocked(): Promise<string[]> {
  return fuehreAus(async () => {
    const treffer = await getDocs(collection(getDb(), PFAD.blocked))
    return treffer.docs.map((eintrag) => eintrag.id)
  }, 'Sperrliste nicht lesbar.')
}

export async function clearReports(): Promise<void> {
  await fuehreAus(async () => {
    const stapel = writeBatch(getDb())
    for (const pfad of [PFAD.reports, PFAD.blocked, PFAD.chats, PFAD.accessLog]) {
      const treffer = await getDocs(collection(getDb(), pfad))
      treffer.forEach((eintrag) => stapel.delete(eintrag.ref))
    }
    await stapel.commit()
  }, 'Aufräumen fehlgeschlagen.')
}
