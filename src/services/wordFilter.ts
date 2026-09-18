import type { FilterVerdict, FlagLevel } from './types'

/**
 * Einfacher lokaler Wortfilter.
 *
 * Bewusst regelbasiert und klein gehalten: Er markiert Nachrichten, er
 * blockiert sie nicht. In Phase 2 ersetzt eine serverseitige Klassifikation
 * diese Datei – die Signatur `scanText()` bleibt dieselbe.
 *
 * Die Listen sind exemplarisch, nicht vollständig.
 */

interface Rule {
  level: FlagLevel
  reason: string
  terms?: string[]
  patterns?: RegExp[]
}

const RULES: Rule[] = [
  {
    level: 'severe',
    reason: 'Hinweis auf minderjährige Person',
    terms: ['minderjährig', 'schülerin', 'schüler', 'noch nicht volljährig'],
    // "bin 15", "ich bin 14 jahre", "16 j."
    patterns: [/\bbin\s*(1[0-7])\b/, /\b(1[0-7])\s*(jahre|j\.?|jährig)/],
  },
  {
    level: 'severe',
    reason: 'Sexuelle Ansprache oder Aufforderung zu Bildern',
    terms: [
      'nacktbild',
      'nacktbilder',
      'nudes',
      'dickpic',
      'sexcam',
      'sexchat',
      'schwanz',
      'titten',
      'ficken',
      'blasen',
      'geil',
    ],
    patterns: [/\b(schick|zeig)\w*\s+(mir\s+)?(mal\s+)?(ein\s+)?(nackt|intim)\w*/],
  },
  {
    level: 'severe',
    reason: 'Drohung oder Gewaltandrohung',
    terms: ['bring dich um', 'ich finde dich', 'töte dich', 'schlag dich'],
  },
  {
    level: 'mild',
    reason: 'Beleidigung',
    terms: ['idiot', 'idiotin', 'dumme kuh', 'hurensohn', 'wichser', 'arschloch', 'spast', 'depp'],
  },
  {
    level: 'mild',
    reason: 'Spam, Werbung oder Weiterleitung',
    terms: ['telegram', 'whatsapp', 'onlyfans', 'snapchat', 'krypto', 'bitcoin', 'investiere'],
    patterns: [
      /\b(https?:\/\/|www\.)\S+/i,
      /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i,
      /(\+41|\+49|\b0)[\s/-]?\d{2}[\s/-]?\d{3}[\s/-]?\d{2}[\s/-]?\d{2}\b/,
    ],
  },
]

/** Kleinschreibung, Umlaut-Varianten und Zeichenwiederholungen vereinheitlichen. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0@]/g, (c) => (c === '0' ? 'o' : 'a'))
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ')
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function scanText(text: string): FilterVerdict | null {
  const haystack = normalize(text)
  if (!haystack.trim()) return null

  let found: FilterVerdict | null = null

  for (const rule of RULES) {
    const terms: string[] = []

    for (const term of rule.terms ?? []) {
      const re = new RegExp(`(^|[^a-zäöüß])${escapeRegExp(normalize(term))}`, 'i')
      if (re.test(haystack)) terms.push(term)
    }
    for (const pattern of rule.patterns ?? []) {
      const match = haystack.match(pattern)
      if (match) terms.push(match[0].trim())
    }

    if (terms.length === 0) continue

    const verdict: FilterVerdict = { level: rule.level, reason: rule.reason, terms }
    // Schwere Treffer gewinnen immer, milde nur, wenn noch nichts gefunden wurde.
    if (rule.level === 'severe') return verdict
    found ??= verdict
  }

  return found
}

/** Anzahl markierter Nachrichten – für die Meldung mitgeschickt. */
export function countFlags(texts: { flag?: FilterVerdict }[]): number {
  return texts.filter((entry) => entry.flag).length
}
