import { getFirestore } from 'firebase-admin/firestore'
import type Stripe from 'stripe'

/**
 * Die Release-Aktion an der Kasse.
 *
 * Dieselbe Rechnung wie src/services/aktion.ts (die Funktionen sind ein
 * eigenes Paket und können die App nicht importieren): eingeschaltet, Start
 * erreicht, und noch innerhalb der Rabatttage → Rabatt in Prozent.
 *
 * Eingestellt wird die Aktion in der Verwaltung der App, gespeichert unter
 * `einstellungen/aktion`.
 */

const TAG = 86_400_000

export interface Aktion {
  aktiv?: boolean
  start?: string | null
  rabattProzent?: number
  rabattTage?: number
}

export function rabattJetzt(aktion: Aktion | undefined, jetzt = Date.now()): number {
  if (!aktion?.aktiv || !aktion.start) return 0
  const beginn = Date.parse(aktion.start)
  const prozent = aktion.rabattProzent ?? 0
  const tage = aktion.rabattTage ?? 0
  if (Number.isNaN(beginn) || jetzt < beginn || prozent <= 0 || tage <= 0) return 0
  return jetzt < beginn + tage * TAG ? prozent : 0
}

export async function aktuellerRabatt(): Promise<number> {
  const snap = await getFirestore().collection('einstellungen').doc('aktion').get()
  return rabattJetzt(snap.data() as Aktion | undefined)
}

/**
 * Der Stripe-Gutschein für einen Prozentsatz – angelegt beim ersten Bedarf.
 *
 * `duration: once` ist der Kern: Bei einem Abo gilt er für die erste
 * Rechnung, also den ersten Monat (bzw. das erste Jahr); danach wird normal
 * abgerechnet. Bei Lifetime ist die erste Rechnung die einzige.
 */
export async function gutschein(stripe: Stripe, prozent: number): Promise<string> {
  const id = `RELEASE-${prozent}`
  try {
    await stripe.coupons.retrieve(id)
  } catch {
    await stripe.coupons.create({ id, percent_off: prozent, duration: 'once', name: `Release-Aktion −${prozent} %` })
  }
  return id
}
