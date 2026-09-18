/**
 * Generator für anonyme Anzeigenamen: Adjektiv + Tier + vierstellige Zahl,
 * z.B. "Blauer Falke 4417". Alle Nomen sind maskulin, damit die starke
 * Adjektivendung ("-er") grammatikalisch immer passt.
 */

const ADJEKTIVE = [
  'Blauer',
  'Stiller',
  'Ruhiger',
  'Grauer',
  'Feiner',
  'Klarer',
  'Leiser',
  'Milder',
  'Kühler',
  'Heller',
  'Später',
  'Weiter',
  'Wacher',
  'Herber',
  'Dunkler',
  'Flinker',
]

const TIERE = [
  'Falke',
  'Reiher',
  'Dachs',
  'Kranich',
  'Luchs',
  'Marder',
  'Habicht',
  'Kiebitz',
  'Steinbock',
  'Fuchs',
  'Uhu',
  'Biber',
  'Iltis',
  'Salamander',
  'Alpensegler',
  'Waldkauz',
]

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function generatePseudonym(): string {
  const zahl = String(1000 + Math.floor(Math.random() * 9000))
  return `${pick(ADJEKTIVE)} ${pick(TIERE)} ${zahl}`
}

/** Eindeutige System-ID – anders als das Pseudonym nie im UI eines Chats. */
export function generateId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return `${prefix}_${rand}`
}
