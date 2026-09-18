/**
 * Domänenmodell des Prototyps.
 *
 * Diese Typen sind die Schnittstelle zwischen UI und "Backend". Wenn in
 * Phase 2 ein echter API-Client hinter `mockApi.ts` gesetzt wird, bleiben
 * sie unverändert – nur die Implementierung dahinter wird getauscht.
 */

export type Language = 'de' | 'fr' | 'it' | 'en'

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Französisch' },
  { value: 'it', label: 'Italienisch' },
  { value: 'en', label: 'Englisch' },
]

export type AgeGroup = '18–24' | '25–34' | '35–49' | '50+'

export const AGE_GROUPS: AgeGroup[] = ['18–24', '25–34', '35–49', '50+']

export const INTERESTS = [
  'Bücher',
  'Musik',
  'Wandern',
  'Kochen',
  'Filme',
  'Technik',
  'Sport',
  'Reisen',
  'Kunst',
  'Games',
  'Politik',
  'Tiere',
] as const

export type Interest = (typeof INTERESTS)[number]

export interface Profile {
  language: Language
  ageGroup: AgeGroup
  interests: string[]
}

export interface User {
  /** Im System eindeutig – gegenüber anderen Nutzern nie sichtbar. */
  id: string
  /** Anzeigename gegenüber anderen Nutzern, z.B. "Blauer Falke 4417". */
  pseudonym: string
  verified: boolean
  /** ISO-Zeitstempel der (simulierten) Verifizierung. */
  verifiedAt: string | null
  profile: Profile
}

export interface Partner {
  id: string
  pseudonym: string
  language: Language
  interests: string[]
}

export type MessageAuthor = 'me' | 'partner' | 'system'

/** Ergebnis des lokalen Wortfilters. */
export type FlagLevel = 'mild' | 'severe'

export interface FilterVerdict {
  level: FlagLevel
  /** Kurze, für Nutzer lesbare Begründung. */
  reason: string
  terms: string[]
}

export interface Message {
  id: string
  author: MessageAuthor
  text: string
  /** Epoch-Millisekunden. */
  ts: number
  flag?: FilterVerdict
}

export interface MatchFilter {
  /** 'egal' = keine Einschränkung. */
  language: Language | 'egal'
  interests: string[]
}

export type ReportReason =
  | 'belaestigung'
  | 'sexuell'
  | 'spam'
  | 'minderjaehrig'
  | 'sonstiges'

export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  {
    value: 'belaestigung',
    label: 'Belästigung oder Beleidigung',
    hint: 'Beschimpfungen, Drohungen, Herabwürdigung.',
  },
  {
    value: 'sexuell',
    label: 'Sexuelle Inhalte',
    hint: 'Ungewollte sexuelle Ansprache, Aufforderung zu Bildern.',
  },
  { value: 'spam', label: 'Spam oder Werbung', hint: 'Links, Verkauf, Weiterleitung auf andere Plattformen.' },
  {
    value: 'minderjaehrig',
    label: 'Person ist minderjährig',
    hint: 'Hinweise darauf, dass das Gegenüber unter 18 ist.',
  },
  { value: 'sonstiges', label: 'Sonstiges', hint: 'Passt in keine der Kategorien.' },
]

export type ReportStatus = 'offen' | 'geprueft' | 'gesperrt'

export interface Report {
  id: string
  createdAt: string
  reporterId: string
  reporterPseudonym: string
  reportedId: string
  reportedPseudonym: string
  reason: ReportReason
  note: string
  /** Bewusst nur die letzten Nachrichten – im UI transparent gemacht. */
  excerpt: { author: MessageAuthor; text: string; ts: number }[]
  /** Treffer des lokalen Wortfilters im Verlauf. */
  autoFlags: number
  status: ReportStatus
}

export interface ReportInput {
  reason: ReportReason
  note: string
  partner: Partner
  messages: Message[]
}

/** Zustand der (simulierten) Verifizierung. */
export type VerificationStage =
  | 'idle'
  | 'dokument'
  | 'liveness'
  | 'abgleich'
  | 'fertig'

export interface Session {
  user: User | null
  storageAvailable: boolean
}
