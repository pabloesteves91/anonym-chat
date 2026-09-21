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
  /** Kennung des Preises in Stripe. */
  priceId: string
  /** Abo oder einmalige Zahlung – bestimmt den Checkout-Modus. */
  art: 'abo' | 'einmalig'
}

export const TARIFE: Record<PlanId, Tarif> = {
  'plus-monat': { priceId: 'price_HIER_EINTRAGEN_MONAT', art: 'abo' },
  'plus-jahr': { priceId: 'price_HIER_EINTRAGEN_JAHR', art: 'abo' },
  lifetime: { priceId: 'price_HIER_EINTRAGEN_LIFETIME', art: 'einmalig' },
}

export function istPlanId(wert: unknown): wert is PlanId {
  return typeof wert === 'string' && wert in TARIFE
}

export function istEingerichtet(plan: PlanId): boolean {
  return !TARIFE[plan].priceId.includes('HIER_EINTRAGEN')
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
