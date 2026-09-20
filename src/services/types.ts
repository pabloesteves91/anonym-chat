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

/** Stand der Verifizierung aus Sicht des Nutzers. */
export type VerificationStatus = 'offen' | 'wartet' | 'verifiziert' | 'abgelehnt'

export interface User {
  /** Im System eindeutig – gegenüber anderen Nutzern nie sichtbar. */
  id: string
  /** Anzeigename gegenüber anderen Nutzern, z.B. "Blauer Falke 4417". */
  pseudonym: string
  /** Kurzform für "Prüfung bestanden" – Chat setzt das voraus. */
  verified: boolean
  verificationStatus: VerificationStatus
  /** ISO-Zeitstempel der Freigabe durch die Moderation. */
  verifiedAt: string | null
  /** Bestätigte Mobilnummer, im UI nur maskiert sichtbar. */
  phone: string | null
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

/** Worum es beim Treffer geht – steuert Warnung und Meldegrund. */
export type FilterCategory = 'minderjaehrig' | 'sexuell' | 'drohung' | 'beleidigung' | 'spam'

export interface FilterVerdict {
  level: FlagLevel
  category: FilterCategory
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

/** Eine Nachricht, wie sie im Moderationsspeicher liegt. */
export interface TranscriptMessage {
  author: 'me' | 'partner'
  text: string
  ts: number
  flag?: FilterVerdict
}

/**
 * Gespeicherter Chatverlauf. Wird nach Ablauf der Frist automatisch
 * entfernt – `expiresAt` ist die einzige Wahrheit dazu.
 */
export interface ChatTranscript {
  id: string
  ownerId: string
  ownerPseudonym: string
  partnerId: string
  partnerPseudonym: string
  startedAt: string
  endedAt: string
  /** Epoch-Millisekunden, ab dann wird der Verlauf gelöscht. */
  expiresAt: number
  messages: TranscriptMessage[]
  flagCount: number
  reported: boolean
}

/** Jeder Blick in einen Verlauf wird festgehalten. */
export interface AccessLogEntry {
  id: string
  at: string
  transcriptId: string
  by: string
  action: 'geoeffnet' | 'geloescht'
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
  /** Verweis auf den gespeicherten Chatverlauf, solange die Frist läuft. */
  transcriptId: string | null
  status: ReportStatus
}

export interface ReportInput {
  reason: ReportReason
  note: string
  partner: Partner
  messages: Message[]
  transcriptId?: string | null
}

/** Schritte des Antragsformulars. */
export type VerifyStep = 'telefon' | 'code' | 'ausweis' | 'selfie' | 'pruefen'

export const VERIFY_STEPS: { key: VerifyStep; label: string }[] = [
  { key: 'telefon', label: 'Mobilnummer' },
  { key: 'code', label: 'SMS-Code' },
  { key: 'ausweis', label: 'Ausweisfoto' },
  { key: 'selfie', label: 'Selfie' },
  { key: 'pruefen', label: 'Absenden' },
]

/** Metadaten eines hochgeladenen Bildes – ohne die Bilddaten selbst. */
export interface UploadMeta {
  name: string
  size: number
  type: string
}

export type RequestDecision = 'wartet' | 'freigegeben' | 'abgelehnt'

export const REJECTION_REASONS = [
  'Ausweis nicht lesbar',
  'Selfie und Ausweis stimmen nicht überein',
  'Dokument abgelaufen',
  'Person offensichtlich unter 18',
  'Verdacht auf Fälschung',
] as const

/** Ein Verifizierungsantrag, wie ihn die Moderation zu sehen bekommt. */
export interface VerificationRequest {
  id: string
  userId: string
  pseudonym: string
  /** Nur maskiert – die vollständige Nummer sieht die Prüfung nicht. */
  phoneMasked: string
  submittedAt: string
  status: RequestDecision
  decidedAt: string | null
  decidedBy: string | null
  rejectionReason: string | null
  documents: { ausweis: UploadMeta; selfie: UploadMeta }
}

/** Bildvorschauen zu einem Antrag – flüchtig, nur im Sitzungsspeicher. */
export interface VerificationImages {
  ausweis: string | null
  selfie: string | null
}

export interface Session {
  user: User | null
  storageAvailable: boolean
  /** Verhaltenskodex vor dem ersten Chat bestätigt? */
  codexAccepted: boolean
  /** Selbst blockierte Konten – unabhängig von Meldungen. */
  selfBlocked: string[]
}
