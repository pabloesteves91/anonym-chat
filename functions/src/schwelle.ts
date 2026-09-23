/**
 * Die Schwelle für den automatischen Hinweis an die Moderation.
 *
 * Reine Rechnung, ohne Datenbank – damit sie sich prüfen lässt und nicht
 * im Browser liegt. Aufgerufen wird sie von `feedbackAuswerten`
 * (feedback.ts) in einer Transaktion; der Stand liegt in
 * `feedbackStand/{konto}`, an den nur der Server kommt.
 *
 * Die Regeln:
 *   - Eine einzelne Bewertung löst nie etwas aus. Erst drei „unangenehm"
 *     von drei verschiedenen Personen aus drei verschiedenen Gesprächen
 *     ergeben einen Hinweis.
 *   - Zählt nur, was in einem echten Gespräch entstand: Der Raum gehört
 *     beiden, und es wurde darin geschrieben (`echt`).
 *   - Wer schon zu einem Hinweis beigetragen hat, zählt für dasselbe Konto
 *     nicht noch einmal – eine Person allein kann nie zwei Fälle erzeugen.
 *   - Nach einem Hinweis beginnt der Zähler von vorn: Die vierte Bewertung
 *     erzeugt keinen zweiten Fall, erst drei weitere, neue Personen.
 *   - Was älter ist als das Fenster, verfällt.
 *   - Dieselbe Bewertung zweimal verarbeitet (Auslöser wiederholt) ändert
 *     nichts.
 *
 * Gesperrt wird hier nie. Der Hinweis landet bei der Moderation, und die
 * entscheidet – wie bei jeder anderen Meldung.
 */

const TAG = 86_400_000

/** Ab so vielen verschiedenen Personen entsteht ein Hinweis. */
export const SCHWELLE = 3
/** Wie lange eine Bewertung für die Schwelle zählt. */
export const FENSTER_MS = 90 * TAG
/** Wie viele verarbeitete Bewertungen gemerkt werden (gegen Doppeltes). */
export const VERARBEITET_MAX = 200

export const WERTE = ['gut', 'neutral', 'unangenehm'] as const
export type Wert = (typeof WERTE)[number]

export const istWert = (wert: unknown): wert is Wert => typeof wert === 'string' && (WERTE as readonly string[]).includes(wert)

export interface Bewertung {
  /** Kennung des Feedback-Dokuments. */
  id: string
  von: string
  chatId: string
  wert: Wert
  /** Millisekunden. */
  at: number
  /** Stammt sie aus einem echten Gespräch zwischen beiden? */
  echt: boolean
}

export interface OffeneBewertung {
  von: string
  chatId: string
  at: number
}

export interface FeedbackStand {
  /** Negative Bewertungen, die noch zu keinem Hinweis geführt haben. */
  offen: OffeneBewertung[]
  /** Personen, die schon zu einem Hinweis beigetragen haben. */
  gezaehlt: string[]
  /** Wie viele Hinweise es zu diesem Konto schon gab. */
  faelle: number
  verarbeitet: string[]
}

export interface Fall {
  nummer: number
  anzahl: number
  chatIds: string[]
  erreichtAm: number
}

export interface Ergebnis {
  stand: FeedbackStand
  fall: Fall | null
  /** Ein „Gutes Gespräch" für die Statistik des bewerteten Kontos. */
  gut: boolean
  /** Hat sich überhaupt etwas geändert? */
  neu: boolean
}

export const LEERER_STAND: FeedbackStand = { offen: [], gezaehlt: [], faelle: 0, verarbeitet: [] }

const texte = (liste: unknown): string[] => (Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [])

/** Was in der Datenbank steht, in eine verlässliche Form bringen. */
export function standAus(daten: unknown): FeedbackStand {
  const d = (daten ?? {}) as Record<string, unknown>
  const offen = Array.isArray(d.offen)
    ? d.offen
        .map((e) => e as Record<string, unknown>)
        .filter((e) => typeof e.von === 'string' && typeof e.chatId === 'string' && typeof e.at === 'number')
        .map((e) => ({ von: e.von as string, chatId: e.chatId as string, at: e.at as number }))
    : []
  return {
    offen,
    gezaehlt: texte(d.gezaehlt),
    faelle: typeof d.faelle === 'number' && d.faelle >= 0 ? Math.floor(d.faelle) : 0,
    verarbeitet: texte(d.verarbeitet),
  }
}

export function werteAus(alt: FeedbackStand, b: Bewertung): Ergebnis {
  if (alt.verarbeitet.includes(b.id)) return { stand: alt, fall: null, gut: false, neu: false }

  const stand: FeedbackStand = {
    ...alt,
    // Abgelaufenes fällt heraus, bevor gezählt wird.
    offen: alt.offen.filter((e) => b.at - e.at < FENSTER_MS),
    verarbeitet: [...alt.verarbeitet, b.id].slice(-VERARBEITET_MAX),
  }
  const ergebnis: Ergebnis = { stand, fall: null, gut: b.wert === 'gut' && b.echt, neu: true }

  if (b.wert !== 'unangenehm' || !b.echt) return ergebnis
  if (stand.gezaehlt.includes(b.von)) return ergebnis
  if (stand.offen.some((e) => e.von === b.von || e.chatId === b.chatId)) return ergebnis

  stand.offen = [...stand.offen, { von: b.von, chatId: b.chatId, at: b.at }]
  if (stand.offen.length < SCHWELLE) return ergebnis

  const nummer = stand.faelle + 1
  ergebnis.fall = {
    nummer,
    anzahl: stand.offen.length,
    chatIds: stand.offen.map((e) => e.chatId),
    erreichtAm: b.at,
  }
  stand.gezaehlt = [...stand.gezaehlt, ...stand.offen.map((e) => e.von)]
  stand.offen = []
  stand.faelle = nummer
  return ergebnis
}

/** Kennung des Hinweises: fest pro Konto und Fall, damit er nie doppelt entsteht. */
export const hinweisId = (konto: string, nummer: number) => `auto-feedback-${konto}-${nummer}`

/**
 * Der Hinweis, so wie er in `reports` liegt – dieselbe Form wie eine
 * Meldung, damit er in derselben Liste mit demselben Ablauf erscheint.
 * Kein Auszug, keine Nachrichten: Es wird nichts zusätzlich gespeichert.
 */
export function automatischerHinweis(konto: string, pseudonym: string, fall: Fall) {
  const erreichtAm = new Date(fall.erreichtAm).toISOString()
  return {
    id: hinweisId(konto, fall.nummer),
    createdAt: erreichtAm,
    reporterId: 'system',
    reporterPseudonym: 'NØNE (automatisch)',
    reportedId: konto,
    reportedPseudonym: pseudonym,
    reason: 'sonstiges',
    note: '',
    excerpt: [],
    autoFlags: 0,
    transcriptId: null,
    status: 'offen',
    automatisch: {
      art: 'feedback-unangenehm',
      anzahl: fall.anzahl,
      chatIds: fall.chatIds,
      erreichtAm,
    },
  }
}
