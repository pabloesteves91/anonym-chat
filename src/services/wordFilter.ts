import type { FilterCategory, FilterVerdict, FlagLevel } from './types'

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
  category: FilterCategory
  reason: string
  terms?: string[]
  patterns?: RegExp[]
}

const RULES: Rule[] = [
  {
    level: 'severe',
    category: 'minderjaehrig',
    reason: 'Hinweis auf minderjährige Person',
    terms: ['minderjährig', 'schülerin', 'schüler', 'noch nicht volljährig'],
    // "bin 15", "ich bin 14 jahre", "16 j."
    patterns: [/\bbin\s*(1[0-7])\b/, /\b(1[0-7])\s*(jahre|j\.?|jährig)/],
  },
  {
    level: 'severe',
    category: 'sexuell',
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
    category: 'drohung',
    reason: 'Drohung oder Gewaltandrohung',
    terms: ['bring dich um', 'ich finde dich', 'töte dich', 'schlag dich'],
  },
  {
    level: 'mild',
    category: 'beleidigung',
    reason: 'Beleidigung',
    terms: ['idiot', 'idiotin', 'dumme kuh', 'hurensohn', 'wichser', 'arschloch', 'spast', 'depp'],
  },
  {
    level: 'mild',
    category: 'spam',
    reason: 'Spam, Werbung oder Weiterleitung',
    terms: ['telegram', 'whatsapp', 'onlyfans', 'snapchat', 'krypto', 'bitcoin', 'investiere'],
    patterns: [
      /\b(https?:\/\/|www\.)\S+/i,
      /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i,
      /(\+41|\+49|\b0)[\s/-]?\d{2}[\s/-]?\d{3}[\s/-]?\d{2}[\s/-]?\d{2}\b/,
    ],
  },
]

/** Nur Kleinschreibung und Leerraum – Ziffern und Zeichen bleiben erhalten. */
function plain(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Zusätzlich Zahlen- und Zeichenersetzungen ("1d10t", "n4ckt") auflösen.
 * Nur für den Wortabgleich – Muster mit Ziffern (Telefon, Altersangabe)
 * oder Zeichen (@ in Adressen) laufen gegen `plain()`, sonst würde die
 * Normalisierung genau das zerstören, wonach sie suchen.
 */
function normalize(text: string): string {
  const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '@': 'a' }
  return plain(text)
    .replace(/[01345@]/g, (char) => LEET[char])
    .replace(/(.)\1{2,}/g, '$1$1')
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function scanText(text: string): FilterVerdict | null {
  const haystack = normalize(text)
  const raw = plain(text)
  if (!raw.trim()) return null

  let found: FilterVerdict | null = null

  for (const rule of RULES) {
    const terms: string[] = []

    for (const term of rule.terms ?? []) {
      const re = new RegExp(`(^|[^a-zäöüß])${escapeRegExp(normalize(term))}`, 'i')
      if (re.test(haystack)) terms.push(term)
    }
    for (const pattern of rule.patterns ?? []) {
      const match = raw.match(pattern)
      if (match) terms.push(match[0].trim())
    }

    if (terms.length === 0) continue

    const verdict: FilterVerdict = { level: rule.level, category: rule.category, reason: rule.reason, terms }
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

/* ------------------------------------------------------------ Anzeigenamen */

export const NAME_MIN = 3
/**
 * Muss mindestens so lang sein, dass jeder gewürfelte Name hineinpasst –
 * sonst erzeugt der Generator Namen, die die eigene Prüfung nicht bestehen.
 * Ein Test über alle Kombinationen hält das fest.
 */
export const NAME_MAX = 28

/**
 * Prüft einen selbst gewählten Anzeigenamen.
 *
 * Anders als bei Nachrichten wird hier abgelehnt statt gewarnt: Der Name
 * steht dauerhaft über jedem Chat, und wer ihn liest, hat ihn sich nicht
 * ausgesucht. Kontaktdaten sind deshalb ebenso ausgeschlossen wie sexuelle
 * oder beleidigende Begriffe.
 */
export function validateDisplayName(name: string): { ok: boolean; error?: string } {
  const wert = name.trim()

  if (wert.length < NAME_MIN) return { ok: false, error: `Mindestens ${NAME_MIN} Zeichen.` }
  if (wert.length > NAME_MAX) return { ok: false, error: `Höchstens ${NAME_MAX} Zeichen.` }
  if (!/^[\p{L}\p{N} .'\-_]+$/u.test(wert)) {
    return { ok: false, error: 'Erlaubt sind Buchstaben, Zahlen, Leerzeichen und . - _' }
  }
  if (/(.)\1{3,}/u.test(wert)) return { ok: false, error: 'Bitte nicht so viele gleiche Zeichen hintereinander.' }

  const verdict = scanText(wert)
  if (verdict) {
    if (verdict.category === 'spam') {
      return { ok: false, error: 'Keine Kontaktdaten oder Verweise auf andere Plattformen im Namen.' }
    }
    return { ok: false, error: `Dieser Name geht nicht: ${verdict.reason.toLowerCase()}.` }
  }

  return { ok: true }
}
