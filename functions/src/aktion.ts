import { getFirestore } from 'firebase-admin/firestore'
import type Stripe from 'stripe'

/**
 * Aktionen an der Kasse.
 *
 * Dieselbe Rechnung wie src/services/aktion.ts (die Funktionen sind ein
 * eigenes Paket und können die App nicht importieren): pro Tarif der höchste
 * Rabatt aus allen laufenden öffentlichen Aktionen und – wenn mitgeschickt
 * und gültig – dem Gutschein. Der Browser schickt nur den Code; was er wert
 * ist, entscheidet dieser Server.
 *
 * Angelegt werden Aktionen in der Verwaltung der App, gespeichert unter
 * `aktionen/{id}`, Gutscheine unter `aktionen/code-<CODE>`.
 */

const TAG = 86_400_000

export interface Aktion {
  aktiv?: boolean
  start?: string | null
  rabattProzent?: number
  rabattTage?: number
  tarife?: string[]
  aboDauer?: 'einmal' | 'monate' | 'dauerhaft'
  aboMonate?: number
  code?: string | null
}

export interface Rabatt {
  prozent: number
  aboDauer: 'einmal' | 'monate' | 'dauerhaft'
  aboMonate: number
}

/** Der Rabatt, den diese Aktion jetzt auf diesen Tarif gibt – 0 heisst keiner. */
export function rabattJetzt(aktion: Aktion | undefined, plan: string, jetzt = Date.now()): number {
  if (!aktion?.aktiv || !aktion.start) return 0
  if (!(aktion.tarife ?? []).includes(plan)) return 0
  const beginn = Date.parse(aktion.start)
  const prozent = aktion.rabattProzent ?? 0
  const tage = aktion.rabattTage ?? 0
  if (Number.isNaN(beginn) || jetzt < beginn || prozent <= 0 || tage <= 0) return 0
  return jetzt < beginn + tage * TAG ? prozent : 0
}

/** Der höchste Rabatt aus mehreren Aktionen – Rabatte werden nicht addiert. */
export function besterRabatt(aktionen: Aktion[], plan: string, jetzt = Date.now()): Rabatt | null {
  let bester: Rabatt | null = null
  for (const aktion of aktionen) {
    const prozent = rabattJetzt(aktion, plan, jetzt)
    if (prozent > (bester?.prozent ?? 0)) {
      bester = { prozent, aboDauer: aktion.aboDauer ?? 'einmal', aboMonate: aktion.aboMonate ?? 1 }
    }
  }
  return bester
}

const CODE = /^[A-Z0-9-]{3,20}$/

export async function rabattFuer(plan: string, code: unknown): Promise<Rabatt | null> {
  const db = getFirestore()
  const oeffentlich = await db.collection('aktionen').where('code', '==', null).get()
  const aktionen = oeffentlich.docs.map((d) => d.data() as Aktion)
  if (typeof code === 'string' && CODE.test(code)) {
    const gutschein = await db.collection('aktionen').doc(`code-${code}`).get()
    if (gutschein.exists) aktionen.push(gutschein.data() as Aktion)
  }
  return besterRabatt(aktionen, plan)
}

/**
 * Der Stripe-Gutschein für einen Rabatt – angelegt beim ersten Bedarf.
 *
 * Die Dauer bildet `aboDauer` ab: `once` gilt für die erste Rechnung (erster
 * Monat bzw. erstes Jahr), `repeating` für die Rechnungen in den ersten N
 * Monaten, `forever` solange das Abo läuft. Bei Lifetime ist die erste
 * Rechnung die einzige.
 */
export async function gutschein(stripe: Stripe, rabatt: Rabatt): Promise<string> {
  const dauer =
    rabatt.aboDauer === 'dauerhaft'
      ? ({ duration: 'forever' } as const)
      : rabatt.aboDauer === 'monate'
        ? ({ duration: 'repeating', duration_in_months: rabatt.aboMonate } as const)
        : ({ duration: 'once' } as const)
  const id = `AKTION-${rabatt.prozent}-${dauer.duration}${'duration_in_months' in dauer ? `-${dauer.duration_in_months}` : ''}`
  try {
    await stripe.coupons.retrieve(id)
  } catch {
    await stripe.coupons.create({ id, percent_off: rabatt.prozent, name: `Aktion −${rabatt.prozent} %`, ...dauer })
  }
  return id
}
