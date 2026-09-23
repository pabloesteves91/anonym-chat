import { GESPRAECHSSTARTER } from '../content/gespraechsstarter'
import type { User } from './types'

/**
 * Testgespräch – nur für die Verwaltung, zum Ausprobieren ohne zweite Person.
 *
 * Ein automatischer Testpartner antwortet, damit sich Vorschläge,
 * Sicherheitsmenü, Feedback und „Nächste Person" allein durchspielen lassen.
 * Er ist überall als Test markiert und nie in der Warteschlange: Wer den
 * Dienst nutzt, trifft nur echte, verifizierte Menschen.
 *
 * Nichts davon geht an den Server – kein Raum, keine Nachricht, keine
 * Meldung, kein Feedback, keine Zählung, keine Statistik.
 *
 * Abschalten: `TESTGESPRAECH_AKTIV` auf `false` setzen.
 */
export const TESTGESPRAECH_AKTIV = true

export const TEST_RAUM_PRAEFIX = 'test-'
export const TEST_PARTNER = { id: 'test-partner', pseudonym: 'Testpartner · NØNE' } as const

/** Nur die Verwaltung, und nur solange der Schalter an ist. */
export const darfTestgespraech = (user: Pick<User, 'rolle'> | null | undefined) =>
  TESTGESPRAECH_AKTIV && user?.rolle === 'verwaltung'

export const istTestRaum = (roomId: string | null | undefined) => Boolean(roomId?.startsWith(TEST_RAUM_PRAEFIX))

export const TEST_HINWEIS =
  'Testgespräch: Dein Gegenüber ist ein automatischer Testpartner, kein Mensch. Nichts davon wird gespeichert, gezählt oder gemeldet.'

/** Wie lange der Testpartner „tippt", bevor er antwortet. */
export const TEST_ANTWORT_NACH_MS = 1_400

const ANTWORTEN = [
  'Spannend! Erzähl mehr.',
  'Ha, gute Frage. Ich muss kurz überlegen …',
  'Das kenne ich. Bei mir ist es ähnlich.',
  'Oh, darüber habe ich noch nie nachgedacht.',
  'Klingt gut. Und wie ist es bei dir?',
]

/**
 * Die Antwort des Testpartners: abwechselnd eine Reaktion und eine Frage
 * aus den Gesprächsstartern, damit es nach Gespräch aussieht.
 */
export function testAntwort(nummer: number, zufall: () => number = Math.random): string {
  if (nummer % 2 === 0) return ANTWORTEN[Math.floor(zufall() * ANTWORTEN.length) % ANTWORTEN.length]
  return GESPRAECHSSTARTER[Math.floor(zufall() * GESPRAECHSSTARTER.length) % GESPRAECHSSTARTER.length].text
}
