import { httpsCallable } from 'firebase/functions'
import { getServerFunctions } from './firebase'
import { ApiError } from './backend/shared'
import type { PlanId } from './plans'

/**
 * Die Kasse aus Sicht des Browsers.
 *
 * Hier wird nichts entschieden und nichts abgerechnet: Der Browser fragt
 * nach einer Checkout-Adresse und geht dorthin. Welcher Preis zu welchem
 * Tarif gehört und wann ein Zugang gilt, bestimmt allein die Serverfunktion
 * in `functions/` – ein Browser darf über einen bezahlten Zugang nicht
 * selbst entscheiden.
 */

/**
 * Ist die Kasse in Betrieb?
 *
 * Auf `false`, solange die Funktionen nicht ausgerollt und die Preise in
 * `functions/src/tarife.ts` nicht eingetragen sind. Dann bleibt es beim
 * Tarifwunsch, den die Verwaltung von Hand freischaltet – das ist ehrlicher
 * als ein Knopf, der ins Leere führt.
 *
 * Umzustellen ist das genau hier, in einer Zeile.
 */
export const KASSE_AKTIV = false

/**
 * Sieht diese Person die Kasse?
 *
 * Alle, sobald `KASSE_AKTIV` an ist. Vorher nur die Verwaltung – zum Testen
 * mit dem Stripe-Testmodus. Der Server lässt im Testmodus ohnehin nur sie
 * bezahlen (`darfBezahlen` in functions/src/tarife.ts).
 */
export function kasseOffenFuer(person: { rolle?: string } | null | undefined): boolean {
  return KASSE_AKTIV || person?.rolle === 'verwaltung'
}

/** Tarife, für die es überhaupt etwas zu bezahlen gibt. */
export type BezahlbarerPlan = Exclude<PlanId, 'frei'>

export function istBezahlbar(plan: PlanId): plan is BezahlbarerPlan {
  return plan !== 'frei'
}

const FEHLERTEXT: Record<string, string> = {
  unauthenticated: 'Dafür musst du angemeldet sein.',
  'invalid-argument': 'Diesen Tarif gibt es nicht.',
  'failed-precondition': 'Die Kasse ist noch nicht eingerichtet.',
  'permission-denied': 'Die Kasse ist noch im Testbetrieb.',
  internal: 'Die Zahlung konnte nicht gestartet werden.',
}

/**
 * Startet die Bezahlung und verlässt die Seite Richtung Stripe.
 *
 * Kommt die Person zurück, landet sie auf der Tarifseite mit
 * `?zahlung=erfolgreich` oder `?zahlung=abgebrochen`. Dass der Zugang dann
 * wirklich gilt, sagt nicht diese Rückkehr, sondern das Konto – gesetzt hat
 * es die Serverfunktion, nachdem Stripe die Quittung gemeldet hat.
 */
export async function starteZahlung(plan: BezahlbarerPlan, code: string | null = null): Promise<void> {
  try {
    const aufruf = httpsCallable<{ plan: string; code: string | null }, { url: string }>(
      getServerFunctions(),
      'createCheckoutSession',
    )
    // Der Code ist nur ein Hinweis: Ob und wie viel Rabatt er gibt, prüft der Server.
    const { data } = await aufruf({ plan, code })
    if (!data?.url) throw new ApiError('Die Kasse hat keine Adresse zurückgegeben.', 'speicher')
    window.location.assign(data.url)
  } catch (error) {
    if (error instanceof ApiError) throw error
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    const kurz = code.replace(/^functions\//, '')
    throw new ApiError(FEHLERTEXT[kurz] ?? 'Die Zahlung konnte nicht gestartet werden.', 'speicher')
  }
}
