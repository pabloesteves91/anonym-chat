/**
 * Aktionen: Gratiszeiten, Rabatte und Gutscheincodes.
 *
 * Angelegt werden sie in der Verwaltung („Aktionen"), gespeichert in
 * Firestore unter `aktionen/{id}`. Eine Aktion hat einen Starttag und kann,
 * ab dort gezählt,
 *   - `gratisTage` lang allen Konten alle Plus-Funktionen geben und/oder
 *   - `rabattTage` lang `rabattProzent` auf die gewählten `tarife` geben.
 *
 * Mit `code` ist der Rabatt ein Gutschein: Er gilt nur für wer den Code
 * eingibt. Solche Aktionen liegen unter `aktionen/code-<CODE>` und lassen
 * sich nicht auflisten, nur mit dem Code abrufen – sonst stünde jeder Code
 * für alle lesbar in der Seite.
 *
 * Überschneiden sich Aktionen, gilt pro Tarif der höchste Rabatt; Rabatte
 * werden nicht addiert. Gratis ist es, wenn irgendeine Aktion gratis ist.
 *
 * Bei Abos regelt `aboDauer`, wie lange der Rabatt gilt: nur die erste
 * Zahlung, die ersten `aboMonate` Monate, oder dauerhaft. Stripe setzt das
 * an der Kasse um (functions/src/aktion.ts, gleiche Rechnung).
 */

import type { PlanId } from './plans'

export type RabattTarif = Exclude<PlanId, 'frei'>
export const RABATT_TARIFE: RabattTarif[] = ['plus-monat', 'plus-jahr', 'lifetime']

export type AboDauer = 'einmal' | 'monate' | 'dauerhaft'

export interface Aktion {
  id: string
  /** Nur für die Verwaltung, z. B. „Release" oder „Sommer 2027". */
  name: string
  /** Der Hauptschalter. Aus heisst aus, egal was sonst eingestellt ist. */
  aktiv: boolean
  /** Beginn als ISO-Zeitstempel; `null`: noch kein Datum gesetzt. */
  start: string | null
  gratisTage: number
  rabattProzent: number
  rabattTage: number
  tarife: RabattTarif[]
  aboDauer: AboDauer
  aboMonate: number
  /** Gutscheincode in Grossbuchstaben; `null`: gilt für alle. */
  code: string | null
  /** Eigener Hinweis auf der Seite; leer: wird aus den Werten erzeugt. */
  hinweisTitel: string
  hinweisText: string
}

export const NEUE_AKTION: Omit<Aktion, 'id'> = {
  name: '',
  aktiv: false,
  start: null,
  gratisTage: 0,
  rabattProzent: 10,
  rabattTage: 14,
  tarife: [...RABATT_TARIFE],
  aboDauer: 'einmal',
  aboMonate: 3,
  code: null,
  hinweisTitel: '',
  hinweisText: '',
}

/** Die Release-Aktion als Vorlage: 14 Tage gratis, 30 Tage 20 %. */
export const RELEASE_VORLAGE: Omit<Aktion, 'id'> = {
  ...NEUE_AKTION,
  name: 'Release',
  gratisTage: 14,
  rabattProzent: 20,
  rabattTage: 30,
}

export const TITEL_MAX = 80
export const TEXT_MAX = 400
export const NAME_MAX = 60

const TAG = 86_400_000

/** Aus Firestore: fehlende Felder mit den Vorgaben auffüllen. */
export function zuAktion(id: string, daten: Partial<Aktion> | undefined): Aktion {
  return { ...NEUE_AKTION, ...(daten ?? {}), id }
}

/** Gutscheincode vereinheitlichen: Grossbuchstaben, ohne Leerzeichen. */
export function normiereCode(eingabe: string): string {
  return eingabe.trim().toUpperCase().replace(/\s+/g, '')
}

export const CODE_MUSTER = /^[A-Z0-9-]{3,20}$/

/** Dokumentkennung einer Code-Aktion. Die Regeln prüfen dasselbe. */
export const codeId = (code: string) => `code-${code}`

/* ------------------------------------------------------- eine Aktion */

export interface AktionsStand {
  /** Gerade jetzt: alle Plus-Funktionen gratis. */
  gratis: boolean
  /** Letzter Gratistag (einschliesslich). */
  gratisBis: Date | null
  /** Rabatt in Prozent, der gerade gilt – 0 heisst keiner. */
  rabatt: number
  /** Letzter Rabatttag (einschliesslich). */
  rabattBis: Date | null
  /** Eingeschaltet, aber noch nicht begonnen. */
  startetAm: Date | null
  /** Eingeschaltet, begonnen und vorbei. */
  vorbei: boolean
}

const KEIN_STAND: AktionsStand = { gratis: false, gratisBis: null, rabatt: 0, rabattBis: null, startetAm: null, vorbei: false }

export function aktionsStand(aktion: Omit<Aktion, 'id'> | null | undefined, jetzt = Date.now()): AktionsStand {
  if (!aktion?.aktiv || !aktion.start) return KEIN_STAND
  const beginn = Date.parse(aktion.start)
  if (Number.isNaN(beginn)) return KEIN_STAND
  if (jetzt < beginn) return { ...KEIN_STAND, startetAm: new Date(beginn) }

  const gratisEnde = beginn + aktion.gratisTage * TAG
  const rabattEnde = beginn + aktion.rabattTage * TAG
  // Ein Gutschein macht nichts gratis – das wäre ein Code für alles.
  const gratis = !aktion.code && aktion.gratisTage > 0 && jetzt < gratisEnde
  const rabattAktiv = aktion.rabattProzent > 0 && aktion.rabattTage > 0 && aktion.tarife.length > 0 && jetzt < rabattEnde
  return {
    gratis,
    gratisBis: gratis ? new Date(gratisEnde - 1) : null,
    rabatt: rabattAktiv ? aktion.rabattProzent : 0,
    rabattBis: rabattAktiv ? new Date(rabattEnde - 1) : null,
    startetAm: null,
    vorbei: !gratis && !rabattAktiv,
  }
}

/* -------------------------------------------------- mehrere Aktionen */

/** Gratis ist es, wenn irgendeine laufende Aktion gratis ist – bis zum spätesten Ende. */
export function gratisBis(aktionen: Aktion[], jetzt = Date.now()): Date | null {
  let bis: Date | null = null
  for (const aktion of aktionen) {
    const stand = aktionsStand(aktion, jetzt)
    if (stand.gratis && stand.gratisBis && (!bis || stand.gratisBis > bis)) bis = stand.gratisBis
  }
  return bis
}

export interface Rabatt {
  prozent: number
  bis: Date
  aktion: Aktion
}

/** Der beste Rabatt, der gerade für diesen Tarif gilt – oder null. */
export function besterRabatt(aktionen: Aktion[], plan: PlanId, jetzt = Date.now()): Rabatt | null {
  if (plan === 'frei') return null
  let bester: Rabatt | null = null
  for (const aktion of aktionen) {
    if (!aktion.tarife.includes(plan)) continue
    const stand = aktionsStand(aktion, jetzt)
    if (!stand.rabatt || !stand.rabattBis) continue
    if (!bester || stand.rabatt > bester.prozent) bester = { prozent: stand.rabatt, bis: stand.rabattBis, aktion }
  }
  return bester
}

/** Laufende Aktionen, die einen Hinweis auf der Seite verdienen. */
export function laufendeAktionen(aktionen: Aktion[], jetzt = Date.now()): Aktion[] {
  return aktionen.filter((aktion) => {
    const stand = aktionsStand(aktion, jetzt)
    return stand.gratis || stand.rabatt > 0
  })
}

/** Preis nach Rabatt, in Rappen – so gerundet, wie Stripe es abzieht. */
export function rabattiert(preisRappen: number, prozent: number): number {
  return Math.round((preisRappen * (100 - prozent)) / 100)
}

/* ------------------------------------------------------------- Texte */

export const datumKurz = (datum: Date) =>
  datum.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })

const TARIF_NAME: Record<RabattTarif, string> = {
  'plus-monat': 'Plus monatlich',
  'plus-jahr': 'Plus jährlich',
  lifetime: 'Lifetime',
}

export function tarifeText(tarife: RabattTarif[]): string {
  if (RABATT_TARIFE.every((t) => tarife.includes(t))) return 'alle Tarife'
  const namen = RABATT_TARIFE.filter((t) => tarife.includes(t)).map((t) => TARIF_NAME[t])
  return namen.length > 1 ? `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}` : (namen[0] ?? 'keinen Tarif')
}

/** Wie lange der Rabatt bei einem Abo gilt – für die Preiskarte. */
export function dauerText(aktion: Pick<Aktion, 'aboDauer' | 'aboMonate'>, plan: PlanId): string | null {
  if (plan === 'lifetime' || plan === 'frei') return null
  if (aktion.aboDauer === 'dauerhaft') return 'dauerhaft, solange das Abo läuft'
  if (aktion.aboDauer === 'monate') {
    if (plan === 'plus-jahr') return aktion.aboMonate <= 12 ? 'im ersten Jahr' : `auf Zahlungen in den ersten ${aktion.aboMonate} Monaten`
    return aktion.aboMonate === 1 ? 'im ersten Monat' : `in den ersten ${aktion.aboMonate} Monaten`
  }
  return plan === 'plus-jahr' ? 'im ersten Jahr' : 'im ersten Monat'
}

/** Der erzeugte Hinweis, wenn die Verwaltung keinen eigenen geschrieben hat. */
export function hinweis(aktion: Aktion, jetzt = Date.now(), eigenerText = true): { titel: string; punkte: string[] } {
  const stand = aktionsStand(aktion, jetzt)
  const punkte: string[] = []
  if (stand.gratis && stand.gratisBis) {
    punkte.push(
      `Bis und mit ${datumKurz(stand.gratisBis)} alle Plus-Funktionen für jedes Konto – unbegrenzt chatten, Filter, eigener Anzeigename, bevorzugt in der Warteschlange. Ohne Buchung, ohne Zahlungsdaten.`,
    )
  }
  if (stand.rabatt && stand.rabattBis) {
    const monat = aktion.tarife.includes('plus-monat') ? dauerText(aktion, 'plus-monat') : null
    punkte.push(
      `Bis und mit ${datumKurz(stand.rabattBis)} ${stand.rabatt} % auf ${tarifeText(aktion.tarife)}${
        aktion.code ? ` mit dem Code ${aktion.code}` : ''
      }.${monat && aktion.aboDauer !== 'dauerhaft' ? ` Bei Plus monatlich gilt der Rabatt ${monat}, danach wird normal abgerechnet.` : ''}`,
    )
  }
  const titel = eigenerText && aktion.hinweisTitel.trim()
    ? aktion.hinweisTitel.trim()
    : stand.gratis
      ? 'Gerade ist alles gratis.'
      : `${stand.rabatt} % auf ${tarifeText(aktion.tarife)}.`
  return { titel, punkte: eigenerText && aktion.hinweisText.trim() ? [aktion.hinweisText.trim()] : punkte }
}

/* ------------------------------------------------------------ Prüfung */

/** Was die Verwaltung eintragen darf. Die Firestore-Regeln prüfen dasselbe. */
export function pruefeAktion(aktion: Omit<Aktion, 'id'>): string | null {
  const ganz = (wert: number, min: number, max: number) => Number.isInteger(wert) && wert >= min && wert <= max
  if (!aktion.name.trim()) return 'Gib der Aktion einen Namen.'
  if (aktion.name.length > NAME_MAX) return `Der Name ist zu lang (höchstens ${NAME_MAX} Zeichen).`
  if (aktion.aktiv && !aktion.start) return 'Zum Einschalten braucht es ein Startdatum.'
  if (aktion.start && Number.isNaN(Date.parse(aktion.start))) return 'Das Startdatum ist ungültig.'
  if (!ganz(aktion.gratisTage, 0, 90)) return 'Gratistage: eine ganze Zahl von 0 bis 90.'
  if (!ganz(aktion.rabattProzent, 0, 90)) return 'Rabatt: eine ganze Zahl von 0 bis 90 Prozent.'
  if (!ganz(aktion.rabattTage, 0, 365)) return 'Rabatttage: eine ganze Zahl von 0 bis 365.'
  if (aktion.rabattProzent > 0 && aktion.tarife.length === 0) return 'Wähle mindestens einen Tarif für den Rabatt.'
  if (aktion.aboDauer === 'monate' && !ganz(aktion.aboMonate, 1, 24)) return 'Abo-Monate: eine ganze Zahl von 1 bis 24.'
  if (aktion.code !== null) {
    if (!CODE_MUSTER.test(aktion.code)) return 'Code: 3 bis 20 Zeichen, nur A–Z, 0–9 und Bindestrich.'
    if (aktion.gratisTage > 0) return 'Ein Gutscheincode kann nichts gratis machen – Gratistage auf 0.'
    if (aktion.rabattProzent === 0) return 'Ein Gutscheincode ohne Rabatt bewirkt nichts.'
  }
  if (aktion.gratisTage === 0 && aktion.rabattProzent === 0) return 'Die Aktion bewirkt nichts: weder Gratistage noch Rabatt.'
  if (aktion.hinweisTitel.length > TITEL_MAX) return `Der Hinweistitel ist zu lang (höchstens ${TITEL_MAX} Zeichen).`
  if (aktion.hinweisText.length > TEXT_MAX) return `Der Hinweistext ist zu lang (höchstens ${TEXT_MAX} Zeichen).`
  return null
}

/*
 * Der aktuelle Stand für die Tarifgrenzen.
 *
 * `grenzen()` in plans.ts wird an vielen Stellen aufgerufen, auch ausserhalb
 * von React. Statt die Aktionen überall durchzureichen, hält dieses Modul die
 * zuletzt geladenen öffentlichen Aktionen; der Store (useAktionen) setzt sie.
 */
let aktuell: Aktion[] = []

export function setzeAktuelleAktionen(aktionen: Aktion[]): void {
  aktuell = aktionen
}

export function aktuelleAktionen(): Aktion[] {
  return aktuell
}
