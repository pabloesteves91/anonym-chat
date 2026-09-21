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

/** Zahlende zuerst – vor den anderen, nicht anstelle von ihnen. */
export function nachVorrang<T extends { bevorzugt: boolean }>(kandidaten: T[]): T[] {
  return [...kandidaten].sort((a, b) => Number(b.bevorzugt) - Number(a.bevorzugt))
}
