/**
 * Neuigkeiten: was sich an NØNE geändert hat.
 *
 * Von Hand geschrieben in der Verwaltung („Neuigkeiten"), gespeichert in
 * Firestore unter `neuigkeiten/{id}`. Sichtbar für alle, auch ohne Konto –
 * aber nur, was veröffentlicht ist; Entwürfe sieht nur die Verwaltung.
 *
 * Die Version ist eine Build-Kennung, wie sie im Fussbereich steht
 * (z. B. „c7f1ae6"). Zur Auswahl stehen die letzten ausgerollten Fassungen
 * (`__VERSIONEN__`, gesetzt in vite.config.ts), die erste ist die neueste.
 */

export type NeuigkeitArt = 'neu' | 'verbessert' | 'behoben'

export const ARTEN: { wert: NeuigkeitArt; label: string }[] = [
  { wert: 'neu', label: 'Neu' },
  { wert: 'verbessert', label: 'Verbessert' },
  { wert: 'behoben', label: 'Behoben' },
]

export interface Neuigkeit {
  id: string
  titel: string
  text: string
  art: NeuigkeitArt
  /** Tag als "JJJJ-MM-TT". */
  datum: string
  /** Build-Kennung, 7 Zeichen; `null`: ohne Version. */
  version: string | null
  /** Aus: Entwurf, nur für die Verwaltung sichtbar. */
  veroeffentlicht: boolean
}

export const TITEL_MAX = 100
export const TEXT_MAX = 2000

export const DATUM_MUSTER = /^\d{4}-\d{2}-\d{2}$/
export const VERSION_MUSTER = /^[0-9a-f]{7}$/

export function heuteDatum(jetzt = new Date()): string {
  return `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`
}

export const NEUE_NEUIGKEIT = (): Omit<Neuigkeit, 'id'> => ({
  titel: '',
  text: '',
  art: 'neu',
  datum: heuteDatum(),
  version: typeof __VERSIONEN__ !== 'undefined' ? (__VERSIONEN__[0]?.id ?? null) : null,
  veroeffentlicht: false,
})

export function zuNeuigkeit(id: string, daten: Partial<Neuigkeit> | undefined): Neuigkeit {
  return { ...NEUE_NEUIGKEIT(), ...(daten ?? {}), id }
}

/** Was die Verwaltung eintragen darf. Die Firestore-Regeln prüfen dasselbe. */
export function pruefeNeuigkeit(n: Omit<Neuigkeit, 'id'>): string | null {
  if (!n.titel.trim()) return 'Gib einen Titel ein.'
  if (n.titel.length > TITEL_MAX) return `Der Titel ist zu lang (höchstens ${TITEL_MAX} Zeichen).`
  if (!n.text.trim()) return 'Beschreibe, was sich geändert hat.'
  if (n.text.length > TEXT_MAX) return `Die Beschreibung ist zu lang (höchstens ${TEXT_MAX} Zeichen).`
  if (!ARTEN.some((a) => a.wert === n.art)) return 'Diese Art gibt es nicht.'
  if (!DATUM_MUSTER.test(n.datum) || Number.isNaN(Date.parse(n.datum))) return 'Das Datum ist ungültig.'
  if (n.version !== null && !VERSION_MUSTER.test(n.version)) return 'Die Version ist ungültig.'
  return null
}

/** Neueste zuerst: nach Datum, bei gleichem Datum nach Titel. */
export function sortiert(liste: Neuigkeit[]): Neuigkeit[] {
  return [...liste].sort((a, b) => b.datum.localeCompare(a.datum) || a.titel.localeCompare(b.titel))
}

/** Die Version, die als „neueste Version" gilt: die des jüngsten Eintrags mit Version. */
export function neuesteVersion(liste: Neuigkeit[]): string | null {
  return sortiert(liste.filter((n) => n.veroeffentlicht)).find((n) => n.version)?.version ?? null
}

export const datumLang = (datum: string) =>
  new Date(`${datum}T00:00:00`).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })

export const artLabel = (art: NeuigkeitArt) => ARTEN.find((a) => a.wert === art)?.label ?? 'Neu'

/* --------------------------------------------------- neu seit dem Besuch */

/** Wie viele gesehene Kennungen sich das Gerät höchstens merkt. */
const MERKEN_MAX = 200

/** Gibt es veröffentlichte Einträge, die dieses Gerät noch nicht gesehen hat? */
export function hatUngelesene(liste: Neuigkeit[], gesehen: string[]): boolean {
  const bekannt = new Set(gesehen)
  return liste.some((n) => n.veroeffentlicht && !bekannt.has(n.id))
}

/** Die neue Liste der gesehenen Kennungen: die aktuellen vorne, gekappt. */
export function alleGesehen(liste: Neuigkeit[], gesehen: string[]): string[] {
  const aktuell = liste.filter((n) => n.veroeffentlicht).map((n) => n.id)
  return [...new Set([...aktuell, ...gesehen])].slice(0, MERKEN_MAX)
}
