/**
 * Die persönliche Statistik – „Deine NØNE Statistik" im Profil.
 *
 * Reine Rechnung, ohne Datenbank. Geschrieben wird `statistik/{konto}` nur
 * vom Server (gespraeche.ts, feedback.ts); lesen darf das Dokument allein
 * die Person, der es gehört. Es steht nichts darin, was andere über sie
 * gesagt haben, ausser der Zahl der „Gutes Gespräch" – kein „unangenehm",
 * kein Moderationsstand, keine Rangliste.
 *
 * Ein Gespräch zählt genau einmal, egal wie es endete (verlassen, gemeldet,
 * blockiert, „Nächste Person", abgebrochen) und egal, wie oft ein Auslöser
 * läuft: Die zuletzt gezählten Räume stehen im Dokument (`gezaehlt`).
 */

const STUNDE = 3_600_000

/** So viele zuletzt gezählte Räume werden gemerkt. */
export const GEZAEHLT_MAX = 100
/** So viele Monate bleiben einzeln stehen. */
export const MONATE_MAX = 24
/** Länger als die Aufbewahrungsfrist kann kein Gespräch dauern. */
export const DAUER_MAX_MS = 72 * STUNDE

export interface Statistik {
  gespraeche: number
  dauerSummeMs: number
  laengsteMs: number
  /** Gespräche pro Monat, Schlüssel 'JJJJ-MM' (Zürcher Zeit). */
  monate: Record<string, number>
  gezaehlt: string[]
}

export const LEERE_STATISTIK: Statistik = { gespraeche: 0, dauerSummeMs: 0, laengsteMs: 0, monate: {}, gezaehlt: [] }

const zahl = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0)

export function statistikAus(daten: unknown): Statistik {
  const d = (daten ?? {}) as Record<string, unknown>
  const monate: Record<string, number> = {}
  if (d.monate && typeof d.monate === 'object') {
    for (const [monat, anzahl] of Object.entries(d.monate as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}$/.test(monat)) monate[monat] = zahl(anzahl)
    }
  }
  return {
    gespraeche: zahl(d.gespraeche),
    dauerSummeMs: zahl(d.dauerSummeMs),
    laengsteMs: zahl(d.laengsteMs),
    monate,
    gezaehlt: Array.isArray(d.gezaehlt) ? d.gezaehlt.filter((x): x is string => typeof x === 'string') : [],
  }
}

/** 'JJJJ-MM' in Zürcher Zeit – so wie die App den Monat anzeigt. */
export function monatVon(ms: number): string {
  const teile = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date(ms))
  const jahr = teile.find((t) => t.type === 'year')?.value
  const monat = teile.find((t) => t.type === 'month')?.value
  return `${jahr}-${monat}`
}

export interface Gespraech {
  chatId: string
  /** Dauer nach Serverzeit; wird auf 0 … DAUER_MAX_MS begrenzt. */
  dauerMs: number
  /** Ende nach Serverzeit, Millisekunden. */
  endeMs: number
}

export function zaehleGespraech(alt: Statistik, g: Gespraech): { stand: Statistik; neu: boolean } {
  if (alt.gezaehlt.includes(g.chatId)) return { stand: alt, neu: false }
  const dauer = Math.min(Math.max(0, Math.round(g.dauerMs)), DAUER_MAX_MS)
  const monat = monatVon(g.endeMs)
  const monate = { ...alt.monate, [monat]: (alt.monate[monat] ?? 0) + 1 }
  // Nur die jüngsten Monate behalten – das Dokument soll nicht endlos wachsen.
  const behalten = Object.keys(monate).sort().slice(-MONATE_MAX)
  return {
    neu: true,
    stand: {
      gespraeche: alt.gespraeche + 1,
      dauerSummeMs: alt.dauerSummeMs + dauer,
      laengsteMs: Math.max(alt.laengsteMs, dauer),
      monate: Object.fromEntries(behalten.map((m) => [m, monate[m]])),
      gezaehlt: [...alt.gezaehlt, g.chatId].slice(-GEZAEHLT_MAX),
    },
  }
}
