/**
 * Zugangskontrolle für die Moderationsansicht.
 *
 * Phase 1: `/admin` ist offen erreichbar, damit der Prototyp ohne Konto
 * testbar bleibt. Das ist die einzige Stelle, die dafür verantwortlich ist –
 * in Phase 2 prüft sie eine echte Anmeldung (Firebase Auth o.ä.) und gibt
 * `erlaubt: false` zurück, sobald jemand ohne Berechtigung kommt. Die Route,
 * der Guard und die UI bleiben dabei unverändert.
 *
 * Was in Phase 2 zusätzlich dazugehört:
 * - Rollenprüfung serverseitig, nicht nur im Browser (hier ist sie eine
 *   Anzeige, keine Sicherung – die Daten liegen ohnehin lokal)
 * - Moderationsdaten nur über authentifizierte Aufrufe ausliefern
 * - Abmelden, Sitzungsablauf, Protokoll der Anmeldungen
 */

export type AccessMode =
  /** Prototyp: offen für alle, die die Adresse kennen. */
  | 'offen'
  /** Angemeldet als berechtigtes Konto. */
  | 'konto'
  /** Angemeldet, aber ohne Berechtigung – oder gar nicht angemeldet. */
  | 'gesperrt'

export interface ModeratorAccess {
  erlaubt: boolean
  mode: AccessMode
}

/** Aktueller Zugang zur Moderation. */
export async function getModeratorAccess(): Promise<ModeratorAccess> {
  // Phase 2: hier die Anmeldung prüfen und bei fehlender Berechtigung
  // { erlaubt: false, mode: 'gesperrt' } zurückgeben.
  return { erlaubt: true, mode: 'offen' }
}
