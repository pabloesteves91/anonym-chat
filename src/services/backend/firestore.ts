import {
  Timestamp,
  collection,
  collectionGroup,
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
import { validateDisplayName } from '../wordFilter'
import { GRATIS_MITGLIEDSCHAFT, grenzen, heute, type Membership, type PlanId, type Verbrauch } from '../plans'
import { ApiError, EXCERPT_LENGTH, maskPhone } from './shared'
import type {
  AccessLogEntry,
  ChatTranscript,
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

/**
 * Die Datenhaltung.
 *
 * Alles liegt auf dem Server: Konten, Anträge, Meldungen, Chaträume. Was hier
 * steht, ist nur die halbe Miete – durchgesetzt wird der Zugriff von
 * `firestore.rules` und `storage.rules`. Eine abgewiesene Regel kommt als
 * `ApiError` mit dem Code 'verweigert' zurück.
 */

const PFAD = {
  users: 'users',
  verifications: 'verifications',
  reports: 'reports',
  chats: 'chats',
  messages: 'messages',
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
  if (code.startsWith('storage/')) {
    return new ApiError(
      code.includes('unauthorized')
        ? 'Der Dateispeicher hat den Upload abgelehnt.'
        : 'Die Bilder konnten nicht hochgeladen werden.',
      'speicher',
    )
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
  membership: Membership
  usage: Verbrauch
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
  membership: { ...GRATIS_MITGLIEDSCHAFT, seit: new Date().toISOString() },
  usage: { tag: heute(), chats: 0 },
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
    membership: data.membership ?? GRATIS_MITGLIEDSCHAFT,
    usage: data.usage ?? { tag: heute(), chats: 0 },
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
  return fuehreAus(async () => {
    const data = await ladeUserDoc(uid())
    if (!grenzen(data?.membership).eigenerName) {
      throw new ApiError('Einen eigenen Namen gibt es mit Plus. Gratis wird gewürfelt.', 'verweigert')
    }
    return await setzePseudonym(name.trim())
  }, 'Name konnte nicht gespeichert werden.')
}

export async function regeneratePseudonym(): Promise<User> {
  return fuehreAus(() => setzePseudonym(generatePseudonym()), 'Name konnte nicht gewürfelt werden.')
}

/* ----------------------------------------------------------------- Tarif */

/**
 * Trägt einen Tarif ein.
 *
 * Aufgerufen wird das heute von Hand durch die Moderation – die Kasse fehlt
 * noch. Die Regeln lassen deshalb nur die Moderation an dieses Feld; ein
 * Konto, das sich selbst auf Lifetime setzen könnte, wäre kein Tarif.
 */
export async function setMembership(userId: string, plan: PlanId, laufzeitTage: number | null): Promise<void> {
  await fuehreAus(async () => {
    const membership: Membership = {
      plan,
      seit: new Date().toISOString(),
      bis: laufzeitTage === null ? null : new Date(Date.now() + laufzeitTage * 86_400_000).toISOString(),
    }
    await updateDoc(doc(getDb(), PFAD.users, userId), { membership })
  }, 'Tarif konnte nicht gesetzt werden.')
}

/**
 * Zählt einen begonnenen Chat und meldet, ob noch einer drin war.
 *
 * Die Grenze wird im Browser geprüft – wer den Code umschreibt, umgeht sie.
 * Verlässlich wird das erst mit einer Serverfunktion; bis dahin ist es eine
 * Bremse, kein Riegel. Missbrauch fällt in der Moderation auf.
 */
export async function registerChatStart(): Promise<{ erlaubt: boolean; verbleibend: number | null }> {
  return fuehreAus(async () => {
    const id = uid()
    const data = await ladeUserDoc(id)
    if (!data) throw new ApiError('Keine Identität vorhanden.', 'nicht-verifiziert')

    const grenze = grenzen(data.membership).chatsProTag
    const tag = heute()
    const bisher = data.usage?.tag === tag ? data.usage.chats : 0

    if (grenze !== null && bisher >= grenze) return { erlaubt: false, verbleibend: 0 }

    await updateDoc(doc(getDb(), PFAD.users, id), { usage: { tag, chats: bisher + 1 } })
    return { erlaubt: true, verbleibend: grenze === null ? null : grenze - bisher - 1 }
  }, 'Der Chat konnte nicht gestartet werden.')
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

export async function resetIdentity(): Promise<void> {
  await fuehreAus(async () => {
    const id = uid()
    await withdrawVerification()
    const alt = await ladeUserDoc(id)
    const neu = leererUser()
    // Ein bezahlter Tarif gehört der Person, nicht dem Pseudonym.
    await setDoc(doc(getDb(), PFAD.users, id), { ...neu, membership: alt?.membership ?? neu.membership })
  }, 'Zurücksetzen fehlgeschlagen.')
}

export async function resetLocalPreferences(): Promise<void> {
  await fuehreAus(
    () => updateDoc(doc(getDb(), PFAD.users, uid()), { codexAccepted: false, selfBlocked: [] }),
    'Zurücksetzen fehlgeschlagen.',
  )
}

/* ----------------------------------------------------------- Chatverläufe */

interface ChatDoc {
  id: string
  participants: string[]
  pseudonyms: Record<string, string>
  startedAt: Timestamp
  endedAt: Timestamp | null
  /** Feld der TTL-Richtlinie: Firestore löscht das Dokument danach selbst. */
  expiresAt: Timestamp
  messageCount?: number
  flagCount: number
  reported: boolean
}

function toTranscript(id: string, data: ChatDoc, messages: TranscriptMessage[] = []): ChatTranscript {
  return {
    id,
    participants: data.participants ?? [],
    pseudonyms: data.pseudonyms ?? {},
    startedAt: data.startedAt?.toDate().toISOString() ?? new Date().toISOString(),
    endedAt: data.endedAt?.toDate().toISOString() ?? null,
    expiresAt: data.expiresAt?.toMillis() ?? 0,
    messages,
    messageCount: data.messageCount ?? messages.length,
    flagCount: data.flagCount ?? 0,
    reported: Boolean(data.reported),
  }
}

export async function listTranscripts(): Promise<ChatTranscript[]> {
  return fuehreAus(async () => {
    // Abgelaufene sind durch die Regeln ohnehin nicht einzeln lesbar; die
    // Abfrage hält sie zusätzlich fern, bis die TTL-Richtlinie sie entfernt.
    const treffer = await getDocs(
      query(collection(getDb(), PFAD.chats), where('expiresAt', '>', Timestamp.now()), orderBy('expiresAt', 'desc')),
    )
    return treffer.docs.map((eintrag) => toTranscript(eintrag.id, eintrag.data() as ChatDoc))
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
    const nachrichten = await getDocs(
      query(collection(getDb(), PFAD.chats, id, PFAD.messages), orderBy('ts', 'asc')),
    )
    await protokolliere(id, 'geoeffnet')
    const messages: TranscriptMessage[] = nachrichten.docs.map((eintrag) => {
      const daten = eintrag.data()
      return {
        author: String(daten.author ?? ''),
        text: String(daten.text ?? ''),
        ts: (daten.ts as Timestamp | null)?.toMillis() ?? 0,
        ...(daten.flag ? { flag: daten.flag as TranscriptMessage['flag'] } : {}),
      }
    })
    return toTranscript(id, snap.data() as ChatDoc, messages)
  }, 'Verlauf nicht lesbar.')
}

export async function deleteTranscript(id: string): Promise<ChatTranscript[]> {
  return fuehreAus(async () => {
    const snap = await getDoc(doc(getDb(), PFAD.chats, id))
    if (!snap.exists()) return await listTranscripts()

    // Unterdokumente verschwinden nicht mit dem Raum – sie müssen einzeln weg.
    const nachrichten = await getDocs(collection(getDb(), PFAD.chats, id, PFAD.messages))
    const stapel = writeBatch(getDb())
    nachrichten.forEach((eintrag) => stapel.delete(eintrag.ref))
    stapel.delete(doc(getDb(), PFAD.chats, id))
    await stapel.commit()

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

export async function submitReport(
  input: ReportInput & { transcriptId?: string | null },
  reporter: User,
): Promise<Report> {
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

/**
 * Räumt Meldungen, Sperren, Verläufe und Protokoll ab.
 *
 * Gedacht für den Start in den Echtbetrieb, nicht für den Alltag: Wer das
 * drückt, löscht auch das Zugriffsprotokoll – und damit den Nachweis darüber,
 * wer was gelesen hat.
 */
export async function clearReports(): Promise<void> {
  await fuehreAus(async () => {
    const nachrichten = await getDocs(collectionGroup(getDb(), PFAD.messages))
    const stapel = writeBatch(getDb())
    nachrichten.forEach((eintrag) => stapel.delete(eintrag.ref))
    for (const pfad of [PFAD.reports, PFAD.blocked, PFAD.chats, PFAD.accessLog]) {
      const treffer = await getDocs(collection(getDb(), pfad))
      treffer.forEach((eintrag) => stapel.delete(eintrag.ref))
    }
    await stapel.commit()
  }, 'Aufräumen fehlgeschlagen.')
}
