/**
 * Domänenmodell.
 *
 * Diese Typen sind die Schnittstelle zwischen Oberfläche und Datenhaltung.
 * Die Oberfläche kennt nur sie; wo die Daten liegen, entscheidet allein
 * `services/api.ts`.
 */

import type { Membership, PlanId, Verbrauch } from './plans'
import type { Rolle } from './roles'
import type { SupportThema } from './support'

export type { SupportThema }

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

/**
 * Geschlecht, wie es bei der Registrierung angegeben wird.
 *
 * Es steuert ausschliesslich die Form des Zufallsnamens – gefiltert oder
 * sortiert wird danach nicht. Angegeben wird es einmal; ändern kann es
 * danach nur die Moderation, damit der Name im Chat verlässlich bleibt.
 */
export type Geschlecht = 'weiblich' | 'maennlich'

export const GESCHLECHTER: { value: Geschlecht; label: string }[] = [
  { value: 'weiblich', label: 'Weiblich' },
  { value: 'maennlich', label: 'Männlich' },
]

/** Stand der Verifizierung aus Sicht des Nutzers. */
export type VerificationStatus = 'offen' | 'wartet' | 'verifiziert' | 'abgelehnt'

export interface User {
  /** Im System eindeutig – gegenüber anderen Nutzern nie sichtbar. */
  id: string
  /** Anzeigename gegenüber anderen Nutzern, z.B. "Blauer Falke 4417". */
  pseudonym: string
  /**
   * Kurzform für "Prüfung bestanden" – Chat setzt das voraus.
   *
   * Abgeleitet aus `verificationStatus`, nicht eigenständig gespeichert:
   * Zwei Felder, die dasselbe bedeuten, laufen auseinander.
   */
  verified: boolean
  /** Der Prüfstand – die einzige Wahrheit darüber, auch in den Regeln. */
  verificationStatus: VerificationStatus
  /** ISO-Zeitstempel der Freigabe durch die Moderation. */
  verifiedAt: string | null
  /** Bestätigte Mobilnummer, im UI nur maskiert sichtbar. */
  phone: string | null
  profile: Profile
  /** Tarif und Laufzeit. */
  membership: Membership
  /** Chats des heutigen Tages – Grundlage der Gratisgrenze. */
  usage: Verbrauch
  /** Hat die Person den Tarif schon einmal bewusst gewählt? */
  planChosen: boolean
  /** Moderation und Verwaltung nutzen den Dienst ohne Tarifgrenzen. */
  rolle: Rolle
  /** Bestimmt die Form des Zufallsnamens. `null`, solange nicht angegeben. */
  geschlecht: Geschlecht | null
}

/**
 * Ein Tarifwunsch.
 *
 * Solange die Kasse fehlt, ist das der Weg von „ich will Plus" zur
 * Moderation: Die Person trägt ihren Wunsch ein, die Moderation sieht ihn
 * und schaltet frei, sobald bezahlt wurde. Mit einer Kasse entfällt das
 * ersatzlos.
 */
export interface PlanRequest {
  userId: string
  pseudonym: string
  plan: string
  at: string
  erledigt: boolean
}

/**
 * Das Gegenüber im Chat. Mehr als diese zwei Angaben gibt es nicht zu
 * wissen – und mehr soll es auch nicht geben.
 */
export interface Partner {
  id: string
  pseudonym: string
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
  /** Kennung des schreibenden Kontos – die Moderation sieht beide Seiten. */
  author: string
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
  /** Beide Kennungen; die Zuordnung zu Namen steht daneben. */
  participants: string[]
  pseudonyms: Record<string, string>
  startedAt: string
  /** `null`, solange der Chat noch läuft. */
  endedAt: string | null
  /** Epoch-Millisekunden, ab dann wird der Verlauf gelöscht. */
  expiresAt: number
  /** Gefüllt erst beim Öffnen – die Übersicht lädt keine Inhalte. */
  messages: TranscriptMessage[]
  messageCount: number
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
  /** Verweis auf den Chatraum, solange die Frist läuft. */
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

/* ------------------------------------------------------------- Support */

export type SupportStatus = 'offen' | 'inArbeit' | 'erledigt'

/**
 * Eine Supportanfrage.
 *
 * Verifizierungsstand und Tarif stehen mit drin, obwohl sie auch im Konto
 * stehen: Sie sagen, wie die Lage **zum Zeitpunkt der Anfrage** war. Wird
 * zwischendurch freigeschaltet oder gesperrt, bleibt die Anfrage trotzdem
 * verständlich.
 */
export interface SupportAnfrage {
  id: string
  createdAt: string
  userId: string
  pseudonym: string
  thema: SupportThema
  betreff: string
  text: string
  /** Wohin die Antwort geht – Konto-Adresse oder abweichender Wunsch. */
  antwortAn: string
  verifizierung: VerificationStatus
  plan: PlanId
  /**
   * Pfade der angehängten Bilder im Dateispeicher.
   *
   * Gespeichert werden Pfade, keine Adressen: Eine Abrufadresse läuft ab und
   * wäre morgen falsch. Verschwinden die Dateien beim Abhaken, bleibt die
   * Liste stehen und sagt, dass es einmal Anhänge gab.
   */
  anhaenge: string[]
  status: SupportStatus
  /**
   * Hat die Moderation einen Chat zu dieser Anfrage eröffnet?
   *
   * Nur sie kann das. Solange es nicht geschehen ist, gibt es für die Person
   * keinen Chat und keinen Menüpunkt. Ältere Anfragen haben das Feld nicht;
   * dort gilt es als nicht eröffnet.
   */
  chatOffen?: boolean
  /** Eine Antwort der Moderation, die die Person noch nicht gesehen hat. */
  ungelesenNutzer?: boolean
  /** Eine Antwort der Person, die die Moderation noch nicht gesehen hat. */
  ungelesenModeration?: boolean
}

/**
 * Eine Nachricht im Supportchat.
 *
 * Wer auf Seiten der Moderation geschrieben hat, steht bewusst nicht drin –
 * die Person sieht "Support", nicht die Adresse oder den Namen dahinter. Das
 * schützt die Moderation genauso, wie der Zufallsname die Nutzenden schützt.
 */
export interface SupportNachricht {
  id: string
  von: 'moderation' | 'nutzer'
  text: string
  /** Millisekunden; bis der Server die Zeit gesetzt hat: jetzt. */
  at: number
}

export interface SupportInput {
  thema: SupportThema
  betreff: string
  text: string
  antwortAn: string
  /** Verkleinerte Bilder, wie sie `createPreview` liefert. */
  anhaenge: { dataUrl: string }[]
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
