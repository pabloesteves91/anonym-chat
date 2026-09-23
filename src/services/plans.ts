/**
 * Tarife.
 *
 * Bewusst klein gehalten: ein Gratiszugang, der für sich allein brauchbar
 * ist, und ein bezahlter Zugang, der Wartezeit und Filter verbessert –
 * monatlich, jährlich oder einmalig auf Dauer.
 *
 * Bezahlt wird (noch) nicht hier: Diese Datei beschreibt nur, was ein Tarif
 * bedeutet und was er kostet. Das Einbuchen übernimmt später die Kasse
 * (siehe `docs/tarife.md`); bis dahin trägt die Moderation einen Tarif von
 * Hand ein. Die Grenzen werden im Browser durchgesetzt – verlässlich wird
 * das erst mit einer Serverfunktion, auch das steht dort.
 */

import { aktuelleAktionen, gratisBis, type Aktion } from './aktion'

export type PlanId = 'frei' | 'plus-monat' | 'plus-jahr' | 'lifetime'

export interface Plan {
  id: PlanId
  name: string
  /** Preis in Rappen, damit nichts gerundet werden muss. */
  preisRappen: number
  /** Wie der Preis zu lesen ist. */
  takt: 'einmalig' | 'monatlich' | 'jährlich' | 'gratis'
  kurz: string
  vorteile: string[]
  /** Auf der Preisseite hervorgehoben. */
  empfohlen?: boolean
}

/** Wie viele Chats ein Gratiskonto pro Tag beginnen darf. */
export const GRATIS_CHATS_PRO_TAG = 10

export const PLAENE: Plan[] = [
  {
    id: 'frei',
    name: 'Frei',
    preisRappen: 0,
    takt: 'gratis',
    kurz: 'Alles, was den Dienst ausmacht – mit einer Obergrenze pro Tag.',
    vorteile: [
      `${GRATIS_CHATS_PRO_TAG} Chats pro Tag`,
      'Sprache wählbar',
      'Verifizierung, Meldungen und Sperren wie überall',
      'Anzeigename wird gewürfelt',
    ],
  },
  {
    id: 'plus-monat',
    name: 'Plus · monatlich',
    preisRappen: 790,
    takt: 'monatlich',
    kurz: 'Unbegrenzt chatten, gezielter suchen, kürzer warten.',
    vorteile: [
      'Unbegrenzt Chats',
      'Filter nach Interessen und Altersgruppe',
      'Bevorzugt in der Warteschlange',
      'Anzeigename frei wählbar',
      'Monatlich kündbar',
    ],
  },
  {
    id: 'plus-jahr',
    name: 'Plus · jährlich',
    preisRappen: 6900,
    takt: 'jährlich',
    kurz: 'Dasselbe wie monatlich, gut ein Viertel günstiger.',
    vorteile: [
      'Alles aus Plus',
      'Entspricht CHF 5.75 pro Monat',
      'Eine Zahlung statt zwölf',
    ],
    empfohlen: true,
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    preisRappen: 17900,
    takt: 'einmalig',
    kurz: 'Einmal zahlen, solange es den Dienst gibt.',
    vorteile: [
      'Alles aus Plus, ohne Ablaufdatum',
      'Keine weitere Zahlung',
      'Gilt auch für später dazukommende Plus-Funktionen',
    ],
  },
]

export function planById(id: PlanId): Plan {
  return PLAENE.find((plan) => plan.id === id) ?? PLAENE[0]
}

/** Was im Konto steht. */
export interface Membership {
  plan: PlanId
  /** ISO-Zeitstempel des Beginns. */
  seit: string
  /** ISO-Zeitstempel des Ablaufs; `null` heisst: läuft nicht ab. */
  bis: string | null
}

export const GRATIS_MITGLIEDSCHAFT: Membership = {
  plan: 'frei',
  seit: new Date(0).toISOString(),
  bis: null,
}

/** Ein abgelaufenes Abo ist ein Gratiskonto – nicht mehr und nicht weniger. */
export function aktiverPlan(mitgliedschaft: Membership | null | undefined, jetzt = Date.now()): PlanId {
  if (!mitgliedschaft) return 'frei'
  if (mitgliedschaft.bis && Date.parse(mitgliedschaft.bis) <= jetzt) return 'frei'
  return mitgliedschaft.plan
}

export interface Grenzen {
  /** `null` heisst: keine Obergrenze. */
  chatsProTag: number | null
  interessenFilter: boolean
  eigenerName: boolean
  bevorzugt: boolean
}

/**
 * Grenzen für eine konkrete Person.
 *
 * Moderation und Verwaltung haben keine: Sie betreiben den Dienst, und ein
 * Tageskontingent, das mitten in einer Prüfung ausgeht, wäre nur im Weg.
 * Bezahlen müssten sie ohnehin an sich selbst.
 */
export function grenzenFuer(
  person: { membership?: Membership | null; rolle?: string } | null | undefined,
  jetzt = Date.now(),
): Grenzen {
  if (person?.rolle === 'moderation' || person?.rolle === 'verwaltung') {
    return { chatsProTag: null, interessenFilter: true, eigenerName: true, bevorzugt: true }
  }
  return grenzen(person?.membership, jetzt)
}

export function grenzen(
  mitgliedschaft: Membership | null | undefined,
  jetzt = Date.now(),
  aktionen: Aktion[] = aktuelleAktionen(),
): Grenzen {
  const plan = aktiverPlan(mitgliedschaft, jetzt)
  // Während einer Gratisaktion gilt Plus für alle.
  if (plan === 'frei' && !gratisBis(aktionen, jetzt)) {
    return { chatsProTag: GRATIS_CHATS_PRO_TAG, interessenFilter: false, eigenerName: false, bevorzugt: false }
  }
  return { chatsProTag: null, interessenFilter: true, eigenerName: true, bevorzugt: true }
}

/** Tagesstempel für die Zählung – lokale Zeit, damit "heute" heisst, was es sagt. */
export function heute(jetzt = new Date()): string {
  const jahr = jetzt.getFullYear()
  const monat = String(jetzt.getMonth() + 1).padStart(2, '0')
  const tag = String(jetzt.getDate()).padStart(2, '0')
  return `${jahr}-${monat}-${tag}`
}

export interface Verbrauch {
  /** Tagesstempel, für den gezählt wurde. */
  tag: string
  chats: number
}

/** Wie viele Chats heute noch drin sind. `null` heisst: unbegrenzt. */
export function verbleibend(
  person: { membership?: Membership | null; usage?: Verbrauch | null; rolle?: string } | null | undefined,
  jetzt = new Date(),
): number | null {
  const grenze = grenzenFuer(person, jetzt.getTime()).chatsProTag
  if (grenze === null) return null
  const heutigerTag = heute(jetzt)
  const verbrauch = person?.usage
  const gezaehlt = verbrauch?.tag === heutigerTag ? verbrauch.chats : 0
  return Math.max(0, grenze - gezaehlt)
}

export function preisText(plan: Plan): string {
  return rappenText(plan.preisRappen)
}

export function rappenText(rappen: number): string {
  if (rappen === 0) return 'CHF 0'
  const betrag = (rappen / 100).toFixed(2).replace(/\.00$/, '.–')
  return `CHF ${betrag}`
}
