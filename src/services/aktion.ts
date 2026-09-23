/**
 * Die Release-Aktion.
 *
 * Ab dem Start (dem Tag, an dem NØNE unter der richtigen Adresse online geht):
 *   - `gratisTage` lang alle Plus-Funktionen für alle Konten, ohne Buchung
 *   - `rabattTage` lang `rabattProzent` auf jeden Tarif. Bei Plus monatlich
 *     gilt der Rabatt nur für den ersten Monat, danach der normale Preis –
 *     Stripe zieht ihn einmal ab (Gutschein mit `duration: once`).
 *
 * Eingestellt wird das in der Verwaltung („Release-Aktion"), gespeichert in
 * Firestore unter `einstellungen/aktion`. Lesen dürfen alle – die Seite
 * zeigt den Hinweis auch ohne Anmeldung –, ändern nur die Verwaltung.
 *
 * Die Gratiszeit wirkt, wie die Tarifgrenzen selbst, im Browser. Der Rabatt
 * wirkt an der Kasse: Die Serverfunktion liest dasselbe Dokument und rechnet
 * mit derselben Logik (functions/src/aktion.ts).
 */

export interface Aktion {
  /** Der Hauptschalter. Aus heisst aus, egal was sonst eingestellt ist. */
  aktiv: boolean
  /** Beginn als ISO-Zeitstempel; `null`: noch kein Datum gesetzt. */
  start: string | null
  gratisTage: number
  rabattProzent: number
  rabattTage: number
}

export const AKTION_STANDARD: Aktion = {
  aktiv: false,
  start: null,
  gratisTage: 14,
  rabattProzent: 20,
  rabattTage: 30,
}

const TAG = 86_400_000

export interface AktionsStand {
  /** Gerade jetzt: alle Plus-Funktionen gratis. */
  gratis: boolean
  /** Letzter Gratistag (einschliesslich), wenn es eine Gratiszeit gibt. */
  gratisBis: Date | null
  /** Rabatt in Prozent, der gerade gilt – 0 heisst keiner. */
  rabatt: number
  /** Letzter Rabatttag (einschliesslich). */
  rabattBis: Date | null
  /** Eingeschaltet, aber noch nicht begonnen. */
  startetAm: Date | null
}

const KEIN_STAND: AktionsStand = { gratis: false, gratisBis: null, rabatt: 0, rabattBis: null, startetAm: null }

export function aktionsStand(aktion: Aktion | null | undefined, jetzt = Date.now()): AktionsStand {
  if (!aktion?.aktiv || !aktion.start) return KEIN_STAND
  const beginn = Date.parse(aktion.start)
  if (Number.isNaN(beginn)) return KEIN_STAND
  if (jetzt < beginn) return { ...KEIN_STAND, startetAm: new Date(beginn) }

  const gratisEnde = beginn + aktion.gratisTage * TAG
  const rabattEnde = beginn + aktion.rabattTage * TAG
  const gratis = aktion.gratisTage > 0 && jetzt < gratisEnde
  const rabattAktiv = aktion.rabattProzent > 0 && aktion.rabattTage > 0 && jetzt < rabattEnde
  return {
    gratis,
    gratisBis: gratis ? new Date(gratisEnde - 1) : null,
    rabatt: rabattAktiv ? aktion.rabattProzent : 0,
    rabattBis: rabattAktiv ? new Date(rabattEnde - 1) : null,
    startetAm: null,
  }
}

/** Preis nach Rabatt, in Rappen – so gerundet, wie Stripe es abzieht. */
export function rabattiert(preisRappen: number, prozent: number): number {
  return Math.round((preisRappen * (100 - prozent)) / 100)
}

/** Was die Verwaltung eintragen darf. Die Firestore-Regeln prüfen dasselbe. */
export function pruefeAktion(aktion: Aktion): string | null {
  if (aktion.aktiv && !aktion.start) return 'Zum Einschalten braucht es ein Startdatum.'
  if (aktion.start && Number.isNaN(Date.parse(aktion.start))) return 'Das Startdatum ist ungültig.'
  const ganz = (wert: number, max: number) => Number.isInteger(wert) && wert >= 0 && wert <= max
  if (!ganz(aktion.gratisTage, 90)) return 'Gratistage: eine ganze Zahl von 0 bis 90.'
  if (!ganz(aktion.rabattProzent, 90)) return 'Rabatt: eine ganze Zahl von 0 bis 90 Prozent.'
  if (!ganz(aktion.rabattTage, 365)) return 'Rabatttage: eine ganze Zahl von 0 bis 365.'
  return null
}

export const datumKurz = (datum: Date) =>
  datum.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })

/*
 * Der aktuelle Stand für die Tarifgrenzen.
 *
 * `grenzen()` in plans.ts wird an vielen Stellen aufgerufen, auch ausserhalb
 * von React. Statt die Aktion überall durchzureichen, hält dieses Modul den
 * zuletzt geladenen Stand; der Store (useAktion) setzt ihn.
 */
let aktuell: Aktion = AKTION_STANDARD

export function setzeAktuelleAktion(aktion: Aktion): void {
  aktuell = aktion
}

export function aktuelleAktion(): Aktion {
  return aktuell
}
