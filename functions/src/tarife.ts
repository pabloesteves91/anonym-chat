/**
 * Zuordnung von Tarif zu Stripe-Preis.
 *
 * Preis-Kennungen sind kein Geheimnis – sie stehen in jeder Checkout-Adresse.
 * Sie gehören deshalb ins Repository und nicht in die Secrets; nachvollziehbar
 * ist besser als versteckt.
 *
 * **Vor dem ersten Einsatz ausfüllen.** Die Kennungen stehen im
 * Stripe-Dashboard unter Produktkatalog → Produkt → Preise und beginnen mit
 * `price_`. Solange hier Platzhalter stehen, lehnt die Funktion jede
 * Bezahlung ab – lieber ein klarer Fehler als eine Zahlung ins Leere.
 */

export type PlanId = 'plus-monat' | 'plus-jahr' | 'lifetime'

export interface Tarif {
  /**
   * Kennung des Preises in Stripe – je Umgebung eine eigene: Die Sandbox
   * (Schlüssel `sk_test_…`) kennt die Live-Preise nicht und umgekehrt.
   */
  preis: { test: string; live: string }
  /** Abo oder einmalige Zahlung – bestimmt den Checkout-Modus. */
  art: 'abo' | 'einmalig'
}

// Angelegt am 24.09.2026, alle in CHF. Welche gilt, entscheidet der
// hinterlegte Schlüssel (preisFuer) – zum Umstellen auf echtes Geld genügt
// es, STRIPE_SECRET_KEY auf den Live-Schlüssel zu setzen.
export const TARIFE: Record<PlanId, Tarif> = {
  'plus-monat': {
    preis: { test: 'price_1UJ4lLBMGYhSyiQEeuv9Ltxd', live: 'price_1UJ4vLBYL7YFNcX58NXL031B' },
    art: 'abo',
  },
  'plus-jahr': {
    preis: { test: 'price_1UJ4lpBMGYhSyiQEGhMh22KP', live: 'price_1UJ4vLBYL7YFNcX5h7blPs9z' },
    art: 'abo',
  },
  lifetime: {
    preis: { test: 'price_1UJ4m9BMGYhSyiQEdl4Afiv0', live: 'price_1UJ4vLBYL7YFNcX5uSfXajEE' },
    art: 'einmalig',
  },
}

/**
 * Wer im Testbetrieb bezahlen darf.
 *
 * Mit einem Testschlüssel (`sk_test_…`) ist jede Zahlung gespielt – die
 * Testkarte 4242… „bezahlt" alles. Dürfte dann jede Person eine Sitzung
 * eröffnen, bekäme jede Plus oder Lifetime geschenkt. Deshalb im Testbetrieb
 * nur die Verwaltung (dieselbe Kennung wie in firestore.rules).
 */
export const TESTZAHLER: readonly string[] = ['RwwpyDrsJldCIx38BcBHVsgTXc32']

export const istTestschluessel = (schluessel: string) => schluessel.startsWith('sk_test_')

/** Darf diese Person unter diesem Schlüssel eine Zahlung starten? */
export function darfBezahlen(schluessel: string, uid: string): boolean {
  return !istTestschluessel(schluessel) || TESTZAHLER.includes(uid)
}

export function istPlanId(wert: unknown): wert is PlanId {
  return typeof wert === 'string' && wert in TARIFE
}

/** Der Preis dieses Tarifs in der Umgebung, zu der der Schlüssel gehört. */
export function preisFuer(plan: PlanId, schluessel: string): string {
  return istTestschluessel(schluessel) ? TARIFE[plan].preis.test : TARIFE[plan].preis.live
}

export function istEingerichtet(plan: PlanId, schluessel: string): boolean {
  return /^price_\w+$/.test(preisFuer(plan, schluessel))
}

/**
 * Wohin Stripe nach der Zahlung zurückschickt.
 *
 * Die Seite läuft mit Hash-Routing, deshalb das Rautezeichen – ohne es
 * landet man auf der 404-Seite von GitHub statt in der App.
 */
export const BASIS_URL = 'https://pabloesteves91.github.io/anonym-chat'
export const ERFOLG_URL = `${BASIS_URL}/#/preise?zahlung=erfolgreich`
export const ABBRUCH_URL = `${BASIS_URL}/#/preise?zahlung=abgebrochen`
