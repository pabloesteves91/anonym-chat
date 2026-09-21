import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  unlink,
  type ConfirmationResult,
} from 'firebase/auth'
import { getFirebaseAuth } from './firebase'
import { ApiError, normalizePhone } from './backend/shared'

/**
 * Bestätigung der Mobilnummer per echter SMS.
 *
 * Verschickt wird sie von Firebase Phone Authentication. Die Nummer wird dabei
 * nicht bloss geprüft, sondern fest mit dem Konto verbunden – und genau darin
 * liegt der Sinn: Firebase lässt dieselbe Nummer kein zweites Mal zu. Wer
 * gesperrt wird, kann sich also nicht mit einem neuen Konto und derselben
 * Nummer zurückholen.
 *
 * Voraussetzung in der Firebase-Konsole: Anmeldeart "Telefon" aktiviert und
 * die ausliefernde Domain unter "Autorisierte Domains" eingetragen. Fehlt das,
 * kommt `auth/operation-not-allowed` beziehungsweise `auth/unauthorized-domain`
 * zurück – beides wird unten in Klartext übersetzt.
 */

/** Die unsichtbare reCAPTCHA-Prüfung hängt an diesem Element. */
export const RECAPTCHA_CONTAINER_ID = 'recaptcha-anker'

const FEHLERTEXT: Record<string, string> = {
  'auth/invalid-phone-number': 'Diese Nummer sieht nicht nach einer Mobilnummer aus.',
  'auth/missing-phone-number': 'Bitte eine Mobilnummer eingeben.',
  'auth/quota-exceeded': 'Im Moment können keine SMS verschickt werden. Bitte später erneut versuchen.',
  'auth/too-many-requests': 'Zu viele Versuche von hier aus. Bitte später erneut versuchen.',
  'auth/captcha-check-failed': 'Die Sicherheitsprüfung ist fehlgeschlagen. Seite neu laden und erneut versuchen.',
  'auth/operation-not-allowed': 'SMS-Bestätigung ist in Firebase nicht aktiviert.',
  'auth/unauthorized-domain': 'Diese Domain ist in Firebase nicht für die Anmeldung freigegeben.',
  'auth/credential-already-in-use': 'Diese Nummer gehört bereits zu einem anderen Konto.',
  'auth/account-exists-with-different-credential': 'Diese Nummer gehört bereits zu einem anderen Konto.',
  'auth/invalid-verification-code': 'Der Code stimmt nicht.',
  'auth/code-expired': 'Der Code ist abgelaufen. Bitte einen neuen anfordern.',
  'auth/network-request-failed': 'Keine Verbindung zu Firebase.',
}

function fehler(error: unknown, fallback: string): ApiError {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  return new ApiError(FEHLERTEXT[code] ?? fallback, code.includes('invalid') ? 'ungueltig' : 'speicher')
}

let verifier: RecaptchaVerifier | null = null
let laufend: ConfirmationResult | null = null

/**
 * Die reCAPTCHA-Prüfung lebt nur einmal pro Seitenaufruf. Wird sie nach einem
 * Fehlschlag nicht zurückgesetzt, lehnt Google den zweiten Versuch ab.
 */
function holeVerifier(): RecaptchaVerifier {
  verifier ??= new RecaptchaVerifier(getFirebaseAuth(), RECAPTCHA_CONTAINER_ID, { size: 'invisible' })
  return verifier
}

export function resetVerifier(): void {
  try {
    verifier?.clear()
  } catch {
    /* schon weg */
  }
  verifier = null
}

/** Die Nummer, die bereits am Konto hängt – oder `null`. */
export function bestaetigteNummer(): string | null {
  return getFirebaseAuth().currentUser?.phoneNumber ?? null
}

export interface SmsAnfrage {
  /** Die Nummer in Normalform, wie sie jetzt gilt. */
  phone: string
  /** Es ging keine SMS raus, weil die Nummer schon bestätigt war. */
  bereitsBestaetigt: boolean
}

/**
 * Verschickt die SMS. Hängt bereits eine andere Nummer am Konto, wird sie
 * vorher gelöst – es soll immer genau eine bestätigte Nummer geben.
 */
export async function requestSmsCode(eingabe: string): Promise<SmsAnfrage> {
  const phone = normalizePhone(eingabe)
  if (!phone) throw new ApiError('Diese Nummer sieht nicht nach einer Mobilnummer aus.', 'ungueltig')
  const konto = getFirebaseAuth().currentUser
  if (!konto) throw new ApiError('Nicht angemeldet.', 'nicht-verifiziert')

  if (konto.phoneNumber === phone) {
    laufend = null
    return { phone, bereitsBestaetigt: true }
  }

  if (konto.phoneNumber) {
    try {
      await unlink(konto, 'phone')
    } catch (error) {
      throw fehler(error, 'Die bisherige Nummer konnte nicht gelöst werden.')
    }
  }

  try {
    laufend = await linkWithPhoneNumber(konto, phone, holeVerifier())
    return { phone, bereitsBestaetigt: false }
  } catch (error) {
    // Nach einem Fehlschlag ist die Prüfung verbraucht.
    resetVerifier()
    throw fehler(error, 'Die SMS konnte nicht verschickt werden.')
  }
}

export async function confirmSmsCode(code: string): Promise<void> {
  const geputzt = code.replace(/\D/g, '')
  if (geputzt.length !== 6) throw new ApiError('Der Code besteht aus sechs Ziffern.', 'ungueltig')
  if (!laufend) throw new ApiError('Es läuft keine Bestätigung. Bitte einen neuen Code anfordern.', 'ungueltig')

  try {
    await laufend.confirm(geputzt)
    laufend = null
    resetVerifier()
  } catch (error) {
    throw fehler(error, 'Der Code konnte nicht geprüft werden.')
  }
}
