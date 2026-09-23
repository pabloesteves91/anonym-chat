/**
 * Gesprächsfeedback und persönliche Statistik – die Regeln, ohne Firestore.
 *
 * Feedback ist optional, ein Tipp, und das Gegenüber erfährt nie davon.
 * Es gibt keine Punkte, keine Sterne, keine Rangliste. Was mit einem
 * „Unangenehm" geschieht, entscheidet der Server (functions/src/schwelle.ts):
 * erst drei verschiedene Personen ergeben einen Hinweis an die Moderation.
 */

export type FeedbackWert = 'gut' | 'neutral' | 'unangenehm'

export const FEEDBACK_WERTE: { wert: FeedbackWert; zeichen: string; label: string }[] = [
  { wert: 'gut', zeichen: '👍', label: 'Gutes Gespräch' },
  { wert: 'neutral', zeichen: '😐', label: 'Neutral' },
  { wert: 'unangenehm', zeichen: '👎', label: 'Unangenehm' },
]

/** Eine Bewertung pro Gespräch und Konto – die Kennung sorgt dafür. */
export const feedbackId = (chatId: string, konto: string) => `${chatId}_${konto}`

/** Die Bewertung selbst wird nach einer Woche gelöscht; der Raum ist dann längst weg. */
export const FEEDBACK_FRIST_MS = 7 * 86_400_000

/** Nach welchem Ende gefragt wird. Wer meldet oder ausschliesst, hat schon geantwortet. */
export const nachFeedbackFragen = (grund: string | null) => grund === 'selbst' || grund === 'partner' || grund === 'naechster'

/* ------------------------------------------------------------ Statistik */

/** So wie sie in `statistik/{konto}` liegt; geschrieben nur vom Server. */
export interface Statistik {
  gespraeche: number
  dauerSummeMs: number
  laengsteMs: number
  monate: Record<string, number>
  gut: number
}

export const LEERE_STATISTIK: Statistik = { gespraeche: 0, dauerSummeMs: 0, laengsteMs: 0, monate: {}, gut: 0 }

const zahl = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0)

export function zuStatistik(daten: unknown): Statistik {
  const d = (daten ?? {}) as Record<string, unknown>
  const monate: Record<string, number> = {}
  if (d.monate && typeof d.monate === 'object') {
    for (const [monat, anzahl] of Object.entries(d.monate as Record<string, unknown>)) monate[monat] = zahl(anzahl)
  }
  return {
    gespraeche: zahl(d.gespraeche),
    dauerSummeMs: zahl(d.dauerSummeMs),
    laengsteMs: zahl(d.laengsteMs),
    monate,
    gut: zahl(d.gut),
  }
}

/** 'JJJJ-MM' in Zürcher Zeit – derselbe Schlüssel wie auf dem Server. */
export function monatVon(ms: number): string {
  const teile = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date(ms))
  return `${teile.find((t) => t.type === 'year')?.value}-${teile.find((t) => t.type === 'month')?.value}`
}

export const diesenMonat = (s: Statistik, jetzt = Date.now()) => s.monate[monatVon(jetzt)] ?? 0

export const durchschnittMs = (s: Statistik) => (s.gespraeche > 0 ? Math.round(s.dauerSummeMs / s.gespraeche) : 0)

/** „1 Std. 5 Min.", „12 Min.", „45 Sek." */
export function dauerText(ms: number): string {
  const sekunden = Math.round(ms / 1000)
  if (sekunden < 60) return `${sekunden} Sek.`
  const minuten = Math.round(sekunden / 60)
  if (minuten < 60) return `${minuten} Min.`
  const stunden = Math.floor(minuten / 60)
  const rest = minuten % 60
  return rest ? `${stunden} Std. ${rest} Min.` : `${stunden} Std.`
}
