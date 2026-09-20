import * as local from './backend/local'
import * as firestore from './backend/firestore'

/**
 * Die eine Tür zur Datenhaltung.
 *
 * Dahinter liegen zwei Umsetzungen mit identischer Oberfläche: `firestore`
 * für den echten Betrieb, `local` für Tests und Durchläufe ohne Server.
 * Umgeschaltet wird über `VITE_BACKEND`; die Stores merken davon nichts.
 */
export const BACKEND: 'local' | 'firestore' =
  (import.meta.env.VITE_BACKEND as string | undefined) === 'local' ? 'local' : 'firestore'

// Prüft beim Übersetzen, dass die Firestore-Variante nichts auslässt.
type Vollstaendig = Record<keyof typeof local, unknown>
const vollstaendig: Vollstaendig = firestore
void vollstaendig

const impl: typeof local = BACKEND === 'local' ? local : (firestore as unknown as typeof local)

export { ApiError } from './backend/shared'
export type { ApiErrorCode } from './backend/shared'
export type { PartnerUtterance, TranscriptInput, VerificationInput } from './backend/local'

export const RETENTION_MS = local.RETENTION_MS
export const normalizePhone = local.normalizePhone
export const maskPhone = local.maskPhone
export const scanMessage = local.scanMessage

// Identität und Profil
export const ensureIdentity = impl.ensureIdentity
export const getSession = impl.getSession
export const updateProfile = impl.updateProfile
export const setPseudonym = impl.setPseudonym
export const regeneratePseudonym = impl.regeneratePseudonym
export const acceptCodex = impl.acceptCodex
export const blockPartner = impl.blockPartner
export const listSelfBlocked = impl.listSelfBlocked
export const clearSelfBlocked = impl.clearSelfBlocked
export const resetIdentity = impl.resetIdentity
export const resetLocalPreferences = impl.resetLocalPreferences
export const overrideVerificationForTesting = impl.overrideVerificationForTesting

// Verifizierung
export const requestSmsCode = impl.requestSmsCode
export const confirmSmsCode = impl.confirmSmsCode
export const submitVerification = impl.submitVerification
export const getMyVerification = impl.getMyVerification
export const listVerificationRequests = impl.listVerificationRequests
export const getVerificationImages = impl.getVerificationImages
export const decideVerification = impl.decideVerification
export const withdrawVerification = impl.withdrawVerification

// Matching und Chat
export const findMatch = impl.findMatch
export const requestOpener = impl.requestOpener
export const requestReply = impl.requestReply

// Verläufe, Meldungen, Moderation
export const saveTranscript = impl.saveTranscript
export const listTranscripts = impl.listTranscripts
export const openTranscript = impl.openTranscript
export const deleteTranscript = impl.deleteTranscript
export const listAccessLog = impl.listAccessLog
export const submitReport = impl.submitReport
export const listReports = impl.listReports
export const updateReportStatus = impl.updateReportStatus
export const listBlocked = impl.listBlocked
export const clearReports = impl.clearReports
