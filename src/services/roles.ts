/**
 * Wer darf moderieren – und wer darf mehr.
 *
 * Zwei Rollen, weil sie Unterschiedliches anrichten können:
 *
 * - **Moderation** entscheidet über Verifizierungen, liest Meldungen und
 *   Verläufe, sperrt Konten. Das ist die tägliche Arbeit.
 * - **Verwaltung** kann zusätzlich Tarife vergeben und alle Daten löschen,
 *   samt Zugriffsprotokoll. Das ist keine tägliche Arbeit, und wer es kann,
 *   kann auch den Nachweis darüber beseitigen, wer was gelesen hat.
 *
 * Wer Verwaltung hat, hat Moderation automatisch mit.
 *
 * **Diese Listen stehen an drei Stellen** und müssen zusammenpassen:
 * hier (für die Anzeige), in `firestore.rules` und in `storage.rules` (dort
 * wird tatsächlich entschieden). Ändert man nur diese Datei, sieht die
 * Person die Oberfläche und bekommt vom Server auf jede Abfrage eine
 * Absage.
 *
 * Sobald es mehr als eine Handvoll Kennungen sind, gehört das auf Custom
 * Claims umgestellt: eine Liste im Quelltext skaliert nicht, und jede
 * Änderung braucht ein Deployment.
 */

/** Volle Rechte: Moderation plus Tarife und Löschen. */
export const ADMIN_UIDS: readonly string[] = [
  // Fabio
  'RwwpyDrsJldCIx38BcBHVsgTXc32',
]

/**
 * Nur Moderation: Verifizierungen, Meldungen, Verläufe, Sperren.
 *
 * Hier kommen Helferinnen und Helfer hinein – nicht in die Liste darüber.
 * Wer Anträge prüft, braucht keinen Zugriff auf Tarife und schon gar nicht
 * die Möglichkeit, das Zugriffsprotokoll zu löschen.
 */
export const MODERATOR_UIDS: readonly string[] = [
  // 'KENNUNG_DER_PERSON_HIER',
]

export type Rolle = 'nutzer' | 'moderation' | 'verwaltung'

export function rolleFuer(uid: string | null | undefined): Rolle {
  if (!uid) return 'nutzer'
  if (ADMIN_UIDS.includes(uid)) return 'verwaltung'
  if (MODERATOR_UIDS.includes(uid)) return 'moderation'
  return 'nutzer'
}

/** Darf die Moderationsansicht sehen und darin arbeiten. */
export function darfModerieren(uid: string | null | undefined): boolean {
  return rolleFuer(uid) !== 'nutzer'
}

/** Darf zusätzlich Tarife vergeben und Daten löschen. */
export function darfVerwalten(uid: string | null | undefined): boolean {
  return rolleFuer(uid) === 'verwaltung'
}

export const ROLLE_LABEL: Record<Rolle, string> = {
  nutzer: 'Konto',
  moderation: 'Moderation',
  verwaltung: 'Verwaltung',
}
