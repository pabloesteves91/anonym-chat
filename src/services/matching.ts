import type { MatchFilter } from './types'

/**
 * Wer passt zu wem.
 *
 * Ohne Firestore und ohne Zustand, damit sich die Regel prüfen lässt: Ein
 * Treffer entsteht nur, wenn beide Seiten einverstanden sind. Wer nach
 * Interessen sucht, bekommt niemanden zugelost, der nichts davon teilt – und
 * wird umgekehrt auch niemandem zugelost, dessen Wünsche er nicht erfüllt.
 */

export interface Wartend {
  uid: string
  language: string
  interests: string[]
  /** Wonach diese Person selbst filtert; leer heisst: egal. */
  wantsInterests: string[]
  bevorzugt: boolean
}

export function passtZusammen(eintrag: Wartend, filter: MatchFilter, meineInteressen: string[]): boolean {
  if (filter.language !== 'egal' && eintrag.language !== filter.language) return false
  // Die Wünsche der Gegenseite zählen genauso wie die eigenen.
  if (eintrag.wantsInterests.length > 0 && !eintrag.wantsInterests.some((i) => meineInteressen.includes(i))) {
    return false
  }
  if (filter.interests.length > 0 && !filter.interests.some((i) => eintrag.interests.includes(i))) return false
  return true
}

/**
 * Die eigenen Interessen für das Matching: das Profil und das, wonach gerade
 * gesucht wird.
 *
 * Wer nach „Bücher" sucht, interessiert sich selbst für Bücher – auch wenn es
 * nicht im Profil steht. Ohne das fanden sich zwei Personen, die beide nach
 * „Bücher" suchten, nie: Verglichen wurde nur mit dem Profil der anderen Seite.
 */
export function eigeneInteressen(profil: string[], suche: string[]): string[] {
  return [...new Set([...profil, ...suche])]
}

/** Zahlende zuerst – vor den anderen, nicht anstelle von ihnen. */
export function nachVorrang<T extends { bevorzugt: boolean }>(kandidaten: T[]): T[] {
  return [...kandidaten].sort((a, b) => Number(b.bevorzugt) - Number(a.bevorzugt))
}

/* ------------------------------------------------ Auswahl der Kandidaten */

export interface Auswahl<T extends Wartend> {
  /** Alle frischen Einträge ausser dem eigenen und den Ausgeschlossenen. */
  kandidaten: T[]
  /** Davon die, die zu beiden Seiten passen – Zahlende zuerst. */
  passend: T[]
}

/**
 * Wer überhaupt in Frage kommt.
 *
 * Ausgeschlossen ist immer: das eigene Konto, wen man mit „Nicht mehr
 * verbinden" (oder einer Meldung) ausgeschlossen hat, und wer in dieser
 * Suche schon abgelehnt wurde. Das gilt auch nach einer erweiterten Suche –
 * erweitert wird nur der Interessenfilter, nie der Schutz.
 */
export function kandidatenFiltern<T extends Wartend>(
  eintraege: T[],
  optionen: { ich: string; ausgeschlossen: Iterable<string>; filter: MatchFilter; meineInteressen: string[] },
): Auswahl<T> {
  const weg = new Set(optionen.ausgeschlossen)
  const kandidaten = eintraege.filter((e) => e.uid !== optionen.ich && !weg.has(e.uid))
  return {
    kandidaten,
    passend: nachVorrang(kandidaten.filter((e) => passtZusammen(e, optionen.filter, optionen.meineInteressen))),
  }
}

/* ------------------------------------------------------ Warteschlange */

/**
 * Wie es um die Suche steht – in Worten, nie in Zahlen.
 *
 * Wie viele gerade warten, geht niemanden etwas an und würde über die
 * Grösse des Dienstes mehr verraten als nötig. Gezeigt wird eine Stufe,
 * abgeleitet aus dem, was die Suche tatsächlich sieht. Solange noch nichts
 * gesehen wurde, bleibt die Anzeige neutral.
 */
export type Suchstatus = 'neutral' | 'viele' | 'suche' | 'wenige' | 'filterEng'

export const SUCHSTATUS_TEXT: Record<Suchstatus, string> = {
  neutral: 'Suche nach einem passenden Gespräch …',
  viele: 'Viele passende Personen verfügbar',
  suche: 'Suche nach einem passenden Gespräch …',
  wenige: 'Aktuell wenige passende Personen',
  filterEng: 'Deine Filter schränken die Suche ein',
}

/** Ab so vielen passenden Wartenden gilt es als „viele". */
export const VIELE_AB = 5

export function suchstatus(sicht: { kandidaten: number; passend: number; filterAktiv: boolean } | null): Suchstatus {
  if (!sicht) return 'neutral'
  if (sicht.passend >= VIELE_AB) return 'viele'
  // Es warten Leute, aber die Filter lassen keinen durch.
  if (sicht.filterAktiv && sicht.kandidaten > 0 && sicht.passend === 0) return 'filterEng'
  if (sicht.passend > 0) return 'suche'
  return 'wenige'
}

/* ------------------------------------------------- Suche erweitern */

/** Nach so langer Suche mit Interessenfilter wird die Erweiterung angeboten. */
export const ERWEITERUNG_ANGEBOT_NACH_MS = 45_000
/** Wer „Weiter warten" wählt, wird frühestens nach dieser Zeit wieder gefragt. */
export const ERWEITERUNG_ERNEUT_NACH_MS = 60_000

/** Lässt sich diese Suche überhaupt erweitern? Nur ein Interessenfilter. */
export const erweiterbar = (filter: MatchFilter) => filter.interests.length > 0

/**
 * Der Filter nach der Antwort auf „Ohne Interessenfilter weitersuchen?".
 *
 * Geändert wird nur mit ausdrücklicher Zustimmung, und nur die Interessen:
 * Die Sprache bleibt, wie sie gewählt wurde.
 */
export function erweitereFilter(filter: MatchFilter, zustimmung: boolean): MatchFilter {
  if (zustimmung !== true || !erweiterbar(filter)) return filter
  return { language: filter.language, interests: [] }
}
