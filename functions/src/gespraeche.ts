import { FieldValue, getFirestore, type DocumentSnapshot, type Timestamp } from 'firebase-admin/firestore'
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'
import { REGION } from './discord.js'
import { automatischerHinweis, hinweisId, istWert, standAus, werteAus } from './schwelle.js'
import { statistikAus, zaehleGespraech } from './statistik.js'

/**
 * Was nach einem Gespräch auf dem Server passiert.
 *
 *   - `gespraechGezaehlt`: Ein Gespräch ist zu Ende (die App legt dabei
 *     `gespraechsende/{raum}` an). Beide Seiten bekommen es in ihrer
 *     Statistik gutgeschrieben – Dauer nach Serverzeit.
 *   - `gespraechVerfallen`: Ein Raum verschwindet, ohne je beendet worden zu
 *     sein (beide Fenster zu, dann die 72-Stunden-Frist). Er zählt dann hier.
 *   - `feedbackAuswerten`: Eine Bewertung nach dem Gespräch. Ein „Gutes
 *     Gespräch" geht in die Statistik des Gegenübers, ein „unangenehm" in die
 *     Schwelle (schwelle.ts) – und erst bei drei verschiedenen Personen
 *     entsteht ein Hinweis an die Moderation. Gesperrt wird nie automatisch.
 *
 * Bewusst kein Auslöser auf jede Änderung am Raum: Der Raum ändert sich
 * alle paar Sekunden (Tippen, Lebenszeichen); das wären Hunderte Aufrufe pro
 * Gespräch statt einem.
 */

const db = () => getFirestore()

const ms = (zeit: Timestamp | undefined) => zeit?.toMillis() ?? Date.now()

function teilnehmer(raum: DocumentSnapshot): string[] {
  const liste = raum.get('participants') as unknown
  return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string').slice(0, 2) : []
}

/** Beiden Seiten ein Gespräch gutschreiben – höchstens einmal pro Raum. */
async function gutschreiben(chatId: string, konten: string[], dauerMs: number, endeMs: number): Promise<void> {
  await db().runTransaction(async (tx) => {
    const refs = konten.map((konto) => db().collection('statistik').doc(konto))
    const staende = await Promise.all(refs.map((ref) => tx.get(ref)))
    staende.forEach((snap, i) => {
      const { stand, neu } = zaehleGespraech(statistikAus(snap.data()), { chatId, dauerMs, endeMs })
      if (neu) tx.set(refs[i], stand, { merge: true })
    })
  })
}

export const gespraechGezaehlt = onDocumentCreated(
  { document: 'gespraechsende/{chatId}', region: REGION },
  async (event) => {
    const ende = event.data
    if (!ende) return
    const raum = await db().collection('chats').doc(event.params.chatId).get()
    const konten = teilnehmer(raum)
    if (!raum.exists || konten.length !== 2) return
    const endeMs = ms(ende.createTime)
    await gutschreiben(event.params.chatId, konten, endeMs - ms(raum.createTime), endeMs)
  },
)

export const gespraechVerfallen = onDocumentDeleted(
  { document: 'chats/{chatId}', region: REGION },
  async (event) => {
    const raum = event.data
    if (!raum) return
    // Beendet: dann hat `gespraechGezaehlt` schon gezählt.
    const ende = await db().collection('gespraechsende').doc(event.params.chatId).get()
    if (ende.exists) return
    const konten = teilnehmer(raum)
    if (konten.length !== 2) return
    // Das letzte Lebenszeichen im Raum ist das Ende.
    const endeMs = ms(raum.updateTime)
    await gutschreiben(event.params.chatId, konten, endeMs - ms(raum.createTime), endeMs)
  },
)

export const feedbackAuswerten = onDocumentCreated(
  { document: 'feedback/{id}', region: REGION },
  async (event) => {
    const daten = event.data?.data()
    if (!daten) return
    const { von, ueber, chatId, wert } = daten as Record<string, unknown>
    if (typeof von !== 'string' || typeof ueber !== 'string' || typeof chatId !== 'string' || !istWert(wert)) return

    const hinweis = await db().runTransaction(async (tx) => {
      const standRef = db().collection('feedbackStand').doc(ueber)
      const [standSnap, raum] = await Promise.all([tx.get(standRef), tx.get(db().collection('chats').doc(chatId))])

      const konten = teilnehmer(raum)
      // Echt: Der Raum gehört genau diesen beiden, und es wurde geschrieben.
      const echt =
        raum.exists && konten.includes(von) && konten.includes(ueber) && von !== ueber && Number(raum.get('messageCount') ?? 0) >= 1

      const ergebnis = werteAus(standAus(standSnap.data()), {
        id: event.params.id,
        von,
        chatId,
        wert,
        at: ms(event.data?.createTime),
        echt,
      })
      if (!ergebnis.neu) return null

      // Lesen vor dem Schreiben – so will es die Transaktion.
      const konto = ergebnis.fall ? await tx.get(db().collection('users').doc(ueber)) : null

      tx.set(standRef, ergebnis.stand)
      if (ergebnis.gut) tx.set(db().collection('statistik').doc(ueber), { gut: FieldValue.increment(1) }, { merge: true })
      if (ergebnis.fall) {
        const pseudonym = String(konto?.get('pseudonym') ?? 'Unbekannt')
        tx.set(db().collection('reports').doc(hinweisId(ueber, ergebnis.fall.nummer)), automatischerHinweis(ueber, pseudonym, ergebnis.fall))
      }
      return ergebnis.fall
    })

    if (hinweis) logger.info(`Automatischer Hinweis Nr. ${hinweis.nummer} angelegt.`)
  },
)
