/**
 * Die eine Tür zur Datenhaltung.
 *
 * Komponenten und Stores sprechen ausschliesslich mit dieser Datei. Dahinter
 * liegen drei Module: `backend/firestore` für alles Gespeicherte,
 * `backend/live` für den laufenden Chat und `phone` für die SMS-Bestätigung.
 * Wechselt der Unterbau, ändert sich hier die Zuordnung – und sonst nichts.
 */

export { ApiError } from './backend/shared'
export type { ApiErrorCode } from './backend/shared'
export { RETENTION_MS, maskPhone, normalizePhone } from './backend/shared'

export {
  // Identität und Profil
  ensureIdentity,
  getSession,
  updateProfile,
  setPseudonym,
  regeneratePseudonym,
  acceptCodex,
  blockPartner,
  listSelfBlocked,
  clearSelfBlocked,
  resetIdentity,
  resetLocalPreferences,
  // Tarif
  setMembership,
  choosePlan,
  listPlanRequests,
  registerChatStart,
  // Verifizierung
  submitVerification,
  getMyVerification,
  listVerificationRequests,
  getVerificationImages,
  decideVerification,
  withdrawVerification,
  // Verläufe, Meldungen, Moderation
  listTranscripts,
  openTranscript,
  deleteTranscript,
  listAccessLog,
  submitReport,
  listReports,
  updateReportStatus,
  listBlocked,
  clearReports,
} from './backend/firestore'

export {
  // Warteschlange und Raum
  findMatch,
  leaveQueue,
  watchRoom,
  watchMessages,
  sendRoomMessage,
  setTyping,
  markSeen,
  leaveRoom,
  markReported,
  HEARTBEAT_MS,
  MAX_MESSAGE_LENGTH,
} from './backend/live'
export type { LiveMessage, RaumZustand, Treffer } from './backend/live'

export { requestSmsCode, confirmSmsCode, bestaetigteNummer, resetVerifier, RECAPTCHA_CONTAINER_ID } from './phone'
export type { SmsAnfrage } from './phone'

/** Der Wortfilter, wie ihn die Oberfläche zum Warnen benutzt. */
export { scanText as scanMessage } from './wordFilter'
