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
import { kandidatenFiltern } from '../matching'
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
  gespraechsende: 'gespraechsende',
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

/**
 * Wurde ich inzwischen von jemand anderem gegriffen?
 *
 * Steht im eigenen Eintrag eine Raumnummer, zu der es keinen Raum gibt – oder
 * einen, in dem ich gar nicht stehe –, dann hat sie jemand hineingeschrieben,
 * der nicht wirklich gegriffen hat. Das ist kein hypothetischer Fall: Die
 * Regeln erlauben Suchenden genau dieses eine Feld am fremden Eintrag, und sie
 * können dort nicht nachsehen, ob der Raum auch entsteht.
 *
 * Ohne Gegenmassnahme bliebe die Suche für immer hängen: Ein Eintrag mit
 * Raumnummer gilt als vergeben, niemand greift ihn mehr, und die eigene
 * Transaktion bricht selbst ab. Deshalb wird die Nummer hier zurückgesetzt –
 * das darf man am eigenen Eintrag – und weitergesucht.
 */
async function schonVergeben(meineKennung: string): Promise<Treffer | null> {
  const snap = await getDoc(doc(db(), PFAD.queue, meineKennung))
  const daten = snap.data() as QueueDoc | undefined
  if (!daten?.roomId) return null

  const raum = await getDoc(doc(db(), PFAD.chats, daten.roomId)).catch(() => null)
  const inhalt = raum?.exists() ? (raum.data() as ChatDoc) : null
  const partnerId = inhalt?.participants.includes(meineKennung)
    ? inhalt.participants.find((id) => id !== meineKennung)
    : undefined

  if (!inhalt || !partnerId) {
    await freieMichWieder(meineKennung)
    return null
  }

  return {
    roomId: daten.roomId,
    partnerId,
    partnerPseudonym: inhalt.pseudonyms[partnerId] ?? 'Unbekannt',
  }
}

/** Die untergeschobene Raumnummer entfernen, damit die Suche weiterläuft. */
async function freieMichWieder(meineKennung: string): Promise<void> {
  try {
    await updateDoc(doc(db(), PFAD.queue, meineKennung), { roomId: null, since: serverTimestamp() })
  } catch {
    // Gelingt es nicht, hilft der nächste Durchgang oder das Verlassen der
    // Warteschlange – hängen bleibt die Suche dadurch nicht.
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
  optionen: {
    bevorzugt: boolean
    signal?: AbortSignal
    /** Konten, die nie zugelost werden – die eigene Liste „Nicht mehr verbinden". */
    ausgeschlossen?: string[]
    /** Was die Suche gerade sieht – nur für die Stufe in der Warteschlange. */
    onSicht?: (sicht: { kandidaten: number; passend: number }) => void
  },
): Promise<Treffer> {
  // Wer in dieser Suche vom Server abgelehnt wurde (etwa, weil er mich
  // ausgeschlossen hat), wird nicht immer wieder versucht.
  const abgelehnt = new Set<string>()
  // Interessen gibt es nur in der Suche, nicht im Profil: Wer nach „Bücher"
  // sucht, wird auch von denen gefunden, die nach „Bücher" suchen.
  const meineInteressen = filter.interests
  const meinEintrag: Omit<QueueDoc, 'since'> & { since: unknown } = {
    uid: ich.id,
    pseudonym: ich.pseudonym,
    language: ich.profile.language,
    interests: meineInteressen,
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

      const { kandidaten, passend } = kandidatenFiltern(
        wartende.docs.map((eintrag) => eintrag.data() as QueueDoc),
        {
          ich: ich.id,
          ausgeschlossen: [...(optionen.ausgeschlossen ?? []), ...abgelehnt],
          filter,
          meineInteressen,
        },
      )
      optionen.onSicht?.({ kandidaten: kandidaten.length, passend: passend.length })

      for (const kandidat of passend) {
        if (optionen.signal?.aborted) throw new ApiError('Abgebrochen.', 'abgebrochen')
        try {
          return await greife(kandidat, ich)
        } catch (error) {
          if (error instanceof Belegt) continue
          // Abgelehnt von den Regeln: Einer von beiden hat den anderen
          // ausgeschlossen. Nicht noch einmal versuchen.
          if (istVerweigert(error)) abgelehnt.add(kandidat.uid)
          // Sonst heisst eine abgelehnte Transaktion meist: jemand war schneller.
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

/** Das Zeichen für die Statistik überdauert den Raum (72 h) um einen Tag. */
const GESPRAECHSENDE_FRIST_MS = 4 * 86_400_000

/**
 * Den Raum verlassen – egal wie: beendet, gemeldet, blockiert, „Nächste
 * Person" oder weil das Gegenüber ging. Alle Wege führen hierher.
 *
 * Danach wird das Gesprächsende vermerkt; daraus zählt der Server die
 * Statistik beider Seiten, einmal pro Raum. Wer als Zweites geht, findet den
 * Vermerk schon vor – die Regeln lehnen das zweite Anlegen ab, und das ist
 * so gewollt.
 */
export async function leaveRoom(roomId: string, optionen: { vermerken?: boolean } = {}): Promise<void> {
  try {
    await updateDoc(doc(db(), PFAD.chats, roomId), {
      left: arrayUnion(meineId()),
      endedAt: Timestamp.now(),
    })
  } catch {
    /* Der Raum läuft ohnehin ab. */
    return
  }
  if (optionen.vermerken === false) return
  try {
    await setDoc(doc(db(), PFAD.gespraechsende, roomId), {
      von: meineId(),
      at: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + GESPRAECHSENDE_FRIST_MS),
    })
  } catch {
    /* Schon vermerkt – oder der Server zählt beim Ablauf des Raums. */
  }
}

export async function markReported(roomId: string): Promise<void> {
  try {
    await updateDoc(doc(db(), PFAD.chats, roomId), { reported: true })
  } catch {
    /* Die Meldung selbst ist längst gespeichert. */
  }
}

function istVerweigert(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  return code.includes('permission-denied')
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
