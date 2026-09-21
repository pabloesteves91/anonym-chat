import {
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb, getFirebaseAuth } from '../firebase'
import { generateId } from '../pseudonym'
import { scanText } from '../wordFilter'
import { nachVorrang, passtZusammen } from '../matching'
import { ApiError, RETENTION_MS, delay } from './shared'
import type { FilterVerdict, Language, MatchFilter, User } from '../types'

/**
 * Der lebende Chat.
 *
 * Zwei Menschen, keine Skripte. Weil es keinen eigenen Server gibt, macht das
 * Zusammenführen der Browser unter sich aus: Wer sucht, trägt sich in die
 * Warteschlange ein und versucht, eine andere wartende Person zu greifen. Dass
 * dabei niemand doppelt vergeben wird, sichert eine Firestore-Transaktion –
 * wer zu spät kommt, sieht die Nummer des Raums schon gesetzt und probiert es
 * beim nächsten.
 *
 * Alles, was hier steht, steuert nur den Ablauf. Wer überhaupt suchen, lesen
 * und schreiben darf, entscheiden die Security Rules: verifiziert, nicht
 * gesperrt, und im Raum nur, wer darin steht.
 */

const PFAD = {
  queue: 'queue',
  chats: 'chats',
  messages: 'messages',
} as const

/** Ab wann ein Warteschlangeneintrag als verlassen gilt. */
const EINTRAG_FRISCH_MS = 90_000
/** Wie oft ein Lebenszeichen gesetzt wird, während gesucht oder gechattet wird. */
export const HEARTBEAT_MS = 20_000
/** Ab wann das Gegenüber im Raum als abwesend angezeigt wird. */
const ABWESEND_MS = 70_000
/** Pause zwischen zwei Versuchen, jemanden zu greifen. */
const VERSUCH_PAUSE_MS = 1_400
export const MAX_MESSAGE_LENGTH = 2000

function db() {
  return getDb()
}

function meineId(): string {
  const id = getFirebaseAuth().currentUser?.uid
  if (!id) throw new ApiError('Nicht angemeldet.', 'nicht-verifiziert')
  return id
}

interface QueueDoc {
  uid: string
  pseudonym: string
  language: Language
  interests: string[]
  /** Nur erfüllt, wer mindestens ein Interesse teilt – sonst leer. */
  wantsInterests: string[]
  bevorzugt: boolean
  since: Timestamp
  roomId: string | null
}

export interface ChatDoc {
  id: string
  participants: string[]
  pseudonyms: Record<string, string>
  startedAt: Timestamp
  endedAt: Timestamp | null
  expiresAt: Timestamp
  reported: boolean
  flagCount: number
  typing: Record<string, number>
  seen: Record<string, Timestamp>
  left: string[]
}

export interface Treffer {
  roomId: string
  partnerId: string
  partnerPseudonym: string
}

export interface LiveMessage {
  id: string
  author: 'me' | 'partner'
  text: string
  ts: number
  flag?: FilterVerdict
}

export interface RaumZustand {
  partnerTyping: boolean
  partnerOnline: boolean
  /** Das Gegenüber hat den Chat beendet. */
  partnerLeft: boolean
  endedAt: number | null
}

/* ------------------------------------------------------------ Suchen */

function frischeGrenze(): Timestamp {
  return Timestamp.fromMillis(Date.now() - EINTRAG_FRISCH_MS)
}

/** Fehler, der nur bedeutet: dieser Versuch ging daneben, weiter zum nächsten. */
class Belegt extends Error {}

async function greife(kandidat: QueueDoc, ich: User): Promise<Treffer> {
  const roomId = generateId('chat')
  const meinRef = doc(db(), PFAD.queue, ich.id)
  const seinRef = doc(db(), PFAD.queue, kandidat.uid)

  await runTransaction(db(), async (tx) => {
    const [meins, seins] = [await tx.get(meinRef), await tx.get(seinRef)]
    if (!meins.exists() || !seins.exists()) throw new Belegt()
    if ((meins.data() as QueueDoc).roomId) throw new Belegt()
    if ((seins.data() as QueueDoc).roomId) throw new Belegt()

    const jetzt = Timestamp.now()
    const raum: ChatDoc = {
      id: roomId,
      participants: [ich.id, kandidat.uid],
      pseudonyms: { [ich.id]: ich.pseudonym, [kandidat.uid]: kandidat.pseudonym },
      startedAt: jetzt,
      endedAt: null,
      expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS),
      reported: false,
      flagCount: 0,
      typing: {},
      seen: { [ich.id]: jetzt, [kandidat.uid]: jetzt },
      left: [],
    }
    tx.set(doc(db(), PFAD.chats, roomId), raum)
    tx.update(meinRef, { roomId })
    tx.update(seinRef, { roomId })
  })

  return { roomId, partnerId: kandidat.uid, partnerPseudonym: kandidat.pseudonym }
}

/** Wurde ich inzwischen von jemand anderem gegriffen? */
async function schonVergeben(meineKennung: string): Promise<Treffer | null> {
  const snap = await getDoc(doc(db(), PFAD.queue, meineKennung))
  const daten = snap.data() as QueueDoc | undefined
  if (!daten?.roomId) return null

  const raum = await getDoc(doc(db(), PFAD.chats, daten.roomId))
  if (!raum.exists()) return null
  const inhalt = raum.data() as ChatDoc
  const partnerId = inhalt.participants.find((id) => id !== meineKennung)
  if (!partnerId) return null
  return {
    roomId: daten.roomId,
    partnerId,
    partnerPseudonym: inhalt.pseudonyms[partnerId] ?? 'Unbekannt',
  }
}

export async function leaveQueue(): Promise<void> {
  try {
    await deleteDoc(doc(db(), PFAD.queue, meineId()))
  } catch {
    /* Der Eintrag läuft ohnehin ab. */
  }
}

/**
 * Sucht ein Gegenüber und gibt den gemeinsamen Raum zurück.
 *
 * Läuft, bis jemand gefunden ist oder das Signal abbricht – eine feste
 * Obergrenze gibt es nicht, weil "gerade niemand da" kein Fehler ist,
 * sondern ein Zustand. Wie lange gewartet wird, entscheidet die Person.
 */
export async function findMatch(
  filter: MatchFilter,
  ich: User,
  optionen: { bevorzugt: boolean; signal?: AbortSignal; onWartende?: (anzahl: number) => void } ,
): Promise<Treffer> {
  const meinEintrag: Omit<QueueDoc, 'since'> & { since: unknown } = {
    uid: ich.id,
    pseudonym: ich.pseudonym,
    language: ich.profile.language,
    interests: ich.profile.interests,
    wantsInterests: filter.interests,
    bevorzugt: optionen.bevorzugt,
    since: serverTimestamp(),
    roomId: null,
  }

  try {
    await setDoc(doc(db(), PFAD.queue, ich.id), meinEintrag)
  } catch (error) {
    throw uebersetze(error, 'Die Suche konnte nicht gestartet werden.')
  }

  try {
    for (;;) {
      if (optionen.signal?.aborted) throw new ApiError('Abgebrochen.', 'abgebrochen')

      const vergeben = await schonVergeben(ich.id)
      if (vergeben) return vergeben

      const wartende = await getDocs(
        query(
          collection(db(), PFAD.queue),
          where('roomId', '==', null),
          where('since', '>', frischeGrenze()),
          orderBy('since', 'asc'),
          limit(25),
        ),
      )

      const kandidaten = wartende.docs
        .map((eintrag) => eintrag.data() as QueueDoc)
        .filter((eintrag) => eintrag.uid !== ich.id)
      optionen.onWartende?.(kandidaten.length)

      const passende = nachVorrang(
        kandidaten.filter((eintrag) => passtZusammen(eintrag, filter, ich.profile.interests)),
      )

      for (const kandidat of passende) {
        if (optionen.signal?.aborted) throw new ApiError('Abgebrochen.', 'abgebrochen')
        try {
          return await greife(kandidat, ich)
        } catch (error) {
          if (error instanceof Belegt) continue
          // Eine abgelehnte Transaktion heisst meist: jemand war schneller.
          continue
        }
      }

      // Lebenszeichen, damit der eigene Eintrag nicht als verlassen gilt.
      await updateDoc(doc(db(), PFAD.queue, ich.id), { since: serverTimestamp() })
      await delay(VERSUCH_PAUSE_MS, optionen.signal)
    }
  } finally {
    // Der Eintrag verschwindet in jedem Fall – gefunden oder abgebrochen.
    // Der Raum steht davon unabhängig; die Warteschlange ist nur der Weg
    // dorthin.
    await leaveQueue()
  }
}

/* -------------------------------------------------------------- Raum */

function toLiveMessage(id: string, daten: Record<string, unknown>, ich: string): LiveMessage {
  const ts = daten.ts as Timestamp | null
  return {
    id,
    author: daten.author === ich ? 'me' : 'partner',
    text: String(daten.text ?? ''),
    // Bis der Server den Zeitstempel setzt, gilt jetzt – sonst springt die
    // eigene Nachricht beim Eintreffen an eine andere Stelle.
    ts: ts?.toMillis() ?? Date.now(),
    flag: (daten.flag as FilterVerdict | null) ?? undefined,
  }
}

export function watchMessages(roomId: string, onChange: (messages: LiveMessage[]) => void): Unsubscribe {
  const ich = meineId()
  return onSnapshot(
    query(collection(db(), PFAD.chats, roomId, PFAD.messages), orderBy('ts', 'asc'), limit(500)),
    (schnappschuss) => {
      onChange(schnappschuss.docs.map((eintrag) => toLiveMessage(eintrag.id, eintrag.data(), ich)))
    },
    () => onChange([]),
  )
}

export function watchRoom(roomId: string, onChange: (zustand: RaumZustand) => void): Unsubscribe {
  const ich = meineId()
  return onSnapshot(doc(db(), PFAD.chats, roomId), (schnappschuss) => {
    const daten = schnappschuss.data() as ChatDoc | undefined
    if (!daten) {
      onChange({ partnerTyping: false, partnerOnline: false, partnerLeft: true, endedAt: Date.now() })
      return
    }
    const partnerId = daten.participants.find((id) => id !== ich)
    const gesehen = partnerId ? daten.seen?.[partnerId]?.toMillis() : undefined
    const tippt = partnerId ? Number(daten.typing?.[partnerId] ?? 0) : 0
    onChange({
      partnerTyping: Date.now() - tippt < 6_000,
      partnerOnline: gesehen !== undefined && Date.now() - gesehen < ABWESEND_MS,
      partnerLeft: Boolean(partnerId && daten.left?.includes(partnerId)),
      endedAt: daten.endedAt?.toMillis() ?? null,
    })
  })
}

export async function sendRoomMessage(roomId: string, text: string): Promise<FilterVerdict | null> {
  const gekuerzt = text.trim().slice(0, MAX_MESSAGE_LENGTH)
  if (!gekuerzt) return null
  const flag = scanText(gekuerzt)

  try {
    await addDoc(collection(db(), PFAD.chats, roomId, PFAD.messages), {
      author: meineId(),
      text: gekuerzt,
      ts: serverTimestamp(),
      flag: flag ?? null,
      expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS),
    })
    // Zähler am Raum: die Moderationsübersicht liest keine Inhalte, sie
    // braucht nur zu wissen, wie viel und wie auffällig geschrieben wurde.
    await updateDoc(doc(db(), PFAD.chats, roomId), {
      messageCount: increment(1),
      ...(flag ? { flagCount: increment(1) } : {}),
    }).catch(() => {})
    return flag
  } catch (error) {
    throw uebersetze(error, 'Die Nachricht konnte nicht gesendet werden.')
  }
}

/** Tippindikator. Wird gedrosselt aufgerufen – nicht bei jedem Anschlag. */
export async function setTyping(roomId: string): Promise<void> {
  try {
    await updateDoc(doc(db(), PFAD.chats, roomId), { [`typing.${meineId()}`]: Date.now() })
  } catch {
    /* Ein verlorener Tippindikator ist kein Fehler. */
  }
}

/** Lebenszeichen im Raum, damit das Gegenüber Abwesenheit erkennt. */
export async function markSeen(roomId: string): Promise<void> {
  try {
    await updateDoc(doc(db(), PFAD.chats, roomId), { [`seen.${meineId()}`]: Timestamp.now() })
  } catch {
    /* siehe oben */
  }
}

export async function leaveRoom(roomId: string): Promise<void> {
  try {
    await updateDoc(doc(db(), PFAD.chats, roomId), {
      left: arrayUnion(meineId()),
      endedAt: Timestamp.now(),
    })
  } catch {
    /* Der Raum läuft ohnehin ab. */
  }
}

export async function markReported(roomId: string): Promise<void> {
  try {
    await updateDoc(doc(db(), PFAD.chats, roomId), { reported: true })
  } catch {
    /* Die Meldung selbst ist längst gespeichert. */
  }
}

function uebersetze(error: unknown, fallback: string): ApiError {
  if (error instanceof ApiError) return error
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code.includes('permission-denied')) {
    return new ApiError('Dafür fehlen die Rechte – ist die Verifizierung freigegeben?', 'verweigert')
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return new ApiError('Keine Verbindung zur Datenbank.', 'speicher')
  }
  return new ApiError(fallback, 'speicher')
}
