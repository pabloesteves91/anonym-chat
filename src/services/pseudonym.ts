/**
 * Generator für anonyme Anzeigenamen: Adjektiv + Tier + vierstellige Zahl,
 * z.B. "Blauer Falke 4417" oder "Stille Amsel 2098".
 *
 * Der Name folgt dem angegebenen Geschlecht, weil er im Chat das Einzige
 * ist, was über das Gegenüber etwas aussagt. Grammatikalisch getragen wird
 * das vom Tiernamen: maskuline Nomen nehmen die Endung "-er", feminine
 * "-e". Deshalb zwei Listen und ein gemeinsamer Stamm für die Adjektive –
 * so kann keine Kombination entstehen, die falsch klingt.
 */

import type { Geschlecht } from './types'

/** Ohne Endung; sie kommt aus dem Geschlecht. */
const ADJEKTIV_STAMM = [
  'Blau',
  'Still',
  'Ruhig',
  'Grau',
  'Fein',
  'Klar',
  'Leis',
  'Mild',
  'Kühl',
  'Hell',
  'Spät',
  'Weit',
  'Wach',
  'Herb',
  'Dunkl',
  'Flink',
]

const TIERE_MAENNLICH = [
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

const TIERE_WEIBLICH = [
  'Amsel',
  'Eule',
  'Elster',
  'Schwalbe',
  'Möwe',
  'Lerche',
  'Meise',
  'Nachtigall',
  'Gämse',
  'Libelle',
  'Dohle',
  'Krähe',
  'Taube',
  'Wildkatze',
  'Drossel',
  'Bachstelze',
]

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * Baut einen Namen zum Geschlecht.
 *
 * Ohne Angabe fällt er auf die maskuline Form zurück – das betrifft nur den
 * kurzen Moment zwischen Kontoanlage und Angabe im Profil, in dem den Namen
 * ohnehin niemand zu sehen bekommt: Ohne Verifizierung gibt es keinen Chat.
 */
export function generatePseudonym(geschlecht?: Geschlecht | null): string {
  const weiblich = geschlecht === 'weiblich'
  const adjektiv = `${pick(ADJEKTIV_STAMM)}${weiblich ? 'e' : 'er'}`
  const tier = pick(weiblich ? TIERE_WEIBLICH : TIERE_MAENNLICH)
  const zahl = String(1000 + Math.floor(Math.random() * 9000))
  return `${adjektiv} ${tier} ${zahl}`
}

/** Eindeutige System-ID – anders als das Pseudonym nie im UI eines Chats. */
export function generateId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return `${prefix}_${rand}`
}
