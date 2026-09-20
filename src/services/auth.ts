import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthProvider,
  type User,
} from 'firebase/auth'
import { EMULATOR_MODE, MODERATOR_UID, getFirebaseAuth } from './firebase'

/**
 * Zugangskontrolle für die Moderationsansicht.
 *
 * Diese Datei ist die einzige Stelle, die darüber entscheidet. Sie prüft die
 * Anmeldung gegen Firebase Auth; die eigentliche Absicherung der Daten leisten
 * die Security Rules auf dem Server. Was hier passiert, steuert nur, was die
 * Oberfläche zeigt – eine Prüfung im Browser ist eine Anzeige, keine Sicherung.
 */

export type AccessMode =
  /** Angemeldet als berechtigtes Konto. */
  | 'konto'
  /** Nicht angemeldet oder ohne Berechtigung. */
  | 'gesperrt'

export interface ModeratorAccess {
  erlaubt: boolean
  mode: AccessMode
  /** Adresse des angemeldeten Kontos, für die Anzeige. */
  email: string | null
}

export class AuthError extends Error {}

const KEIN_ZUGANG: ModeratorAccess = { erlaubt: false, mode: 'gesperrt', email: null }

/** Reine Auswertung – ohne Firebase, damit sie prüfbar bleibt. */
export function evaluateAccess(user: Pick<User, 'uid' | 'email'> | null): ModeratorAccess {
  if (!user || user.uid !== MODERATOR_UID) return KEIN_ZUGANG
  return { erlaubt: true, mode: 'konto', email: user.email }
}

/** Meldet Änderungen des Zugangs, auch beim ersten Laden. */
export function watchModeratorAccess(onChange: (access: ModeratorAccess) => void): () => void {
  try {
    return onAuthStateChanged(
      getFirebaseAuth(),
      (user) => onChange(evaluateAccess(user)),
      () => onChange(KEIN_ZUGANG),
    )
  } catch {
    // Firebase nicht erreichbar: die Ansicht bleibt zu, die App läuft weiter.
    onChange(KEIN_ZUGANG)
    return () => {}
  }
}

const FEHLERTEXT: Record<string, string> = {
  'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
  'auth/operation-not-allowed': 'Diese Anmeldeart ist in Firebase nicht aktiviert.',
  'auth/popup-closed-by-user': 'Das Anmeldefenster wurde geschlossen.',
  'auth/popup-blocked': 'Der Browser hat das Anmeldefenster blockiert.',
  'auth/unauthorized-domain': 'Diese Domain ist in Firebase nicht freigegeben.',
  'auth/invalid-email': 'Diese E-Mail-Adresse ist nicht gültig.',
  'auth/user-disabled': 'Dieses Konto ist gesperrt.',
  'auth/too-many-requests': 'Zu viele Versuche. Bitte später erneut probieren.',
  'auth/network-request-failed': 'Keine Verbindung zu Firebase.',
}

export async function signInModerator(email: string, password: string): Promise<ModeratorAccess> {
  try {
    await setPersistence(getFirebaseAuth(), browserLocalPersistence)
    const { user } = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
    return await pruefeOderAbmelden(user)
  } catch (error) {
    if (error instanceof AuthError) throw error
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    throw new AuthError(FEHLERTEXT[code] ?? 'Anmeldung fehlgeschlagen.')
  }
}

/** Prüft das angemeldete Konto und meldet es bei fehlender Berechtigung wieder ab. */
async function pruefeOderAbmelden(user: User): Promise<ModeratorAccess> {
  const access = evaluateAccess(user)
  if (!access.erlaubt) {
    await signOut(getFirebaseAuth())
    throw new AuthError('Dieses Konto hat keine Moderationsrechte.')
  }
  return access
}

export type OAuthAnbieter = 'google' | 'apple'

function providerFor(anbieter: OAuthAnbieter): AuthProvider {
  if (anbieter === 'google') return new GoogleAuthProvider()
  // Apple liefert Name und Adresse nur bei der allerersten Anmeldung.
  const apple = new OAuthProvider('apple.com')
  apple.addScope('email')
  apple.addScope('name')
  return apple
}

/** Gründe, bei denen ein eigenes Fenster nicht geht – dann per Weiterleitung. */
const BRAUCHT_WEITERLEITUNG = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/cancelled-popup-request',
])

/**
 * Anmeldung über Google oder Apple.
 *
 * Zuerst im eigenen Fenster, weil man danach dort bleibt, wo man war.
 * Blockiert der Browser das – auf iPhones und in eingebetteten Seiten
 * häufig –, läuft es über eine Weiterleitung: die Seite verlässt den
 * Browser Richtung Anbieter und kommt danach zurück, wo
 * `completeRedirectSignIn()` sie wieder aufnimmt.
 */
async function oauthSignIn(anbieter: OAuthAnbieter): Promise<User> {
  const provider = providerFor(anbieter)
  try {
    await setPersistence(getFirebaseAuth(), browserLocalPersistence)
    const { user } = await signInWithPopup(getFirebaseAuth(), provider)
    return user
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

    if (BRAUCHT_WEITERLEITUNG.has(code)) {
      await signInWithRedirect(getFirebaseAuth(), provider)
      // Die Seite ist ab hier unterwegs; dieses Versprechen löst sich nie ein.
      return new Promise<User>(() => {})
    }
    throw new AuthError(FEHLERTEXT[code] ?? 'Anmeldung fehlgeschlagen.')
  }
}

export async function signInWithProvider(anbieter: OAuthAnbieter): Promise<ModeratorAccess> {
  const user = await oauthSignIn(anbieter)
  return await pruefeOderAbmelden(user)
}

/**
 * Nimmt eine Anmeldung per Weiterleitung wieder auf. Beim normalen Laden
 * ohne vorherige Weiterleitung gibt sie `null` zurück.
 */
export async function completeRedirectSignIn(): Promise<ModeratorAccess | null> {
  try {
    const ergebnis = await getRedirectResult(getFirebaseAuth())
    if (!ergebnis) return null
    return await pruefeOderAbmelden(ergebnis.user)
  } catch (error) {
    if (error instanceof AuthError) throw error
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    throw new AuthError(FEHLERTEXT[code] ?? 'Anmeldung fehlgeschlagen.')
  }
}

/* ------------------------------------------------- Anmeldung für Nutzende */

/**
 * Das angemeldete Konto, wie die App es braucht.
 *
 * Die Adresse dient nur der Zuordnung im System und wird anderen Nutzenden
 * nie gezeigt – im Chat sieht man ausschliesslich das Pseudonym.
 */
export interface AppUser {
  uid: string
  email: string | null
  /** 'google.com' oder 'apple.com' – für die Anzeige in den Einstellungen. */
  providerId: string | null
}

function toAppUser(user: User | null): AppUser | null {
  if (!user) return null
  return {
    uid: user.uid,
    email: user.email,
    providerId: user.providerData[0]?.providerId ?? null,
  }
}

/** Meldet das angemeldete Konto und jede spätere Änderung. */
export function watchUser(onChange: (user: AppUser | null) => void): () => void {
  try {
    return onAuthStateChanged(
      getFirebaseAuth(),
      (user) => onChange(toAppUser(user)),
      () => onChange(null),
    )
  } catch {
    onChange(null)
    return () => {}
  }
}

/** Anmeldung mit Google oder Apple, mit Rückfall auf Weiterleitung. */
export async function signInUser(anbieter: OAuthAnbieter): Promise<AppUser> {
  const user = await oauthSignIn(anbieter)
  return toAppUser(user) as AppUser
}

/** Nimmt eine Anmeldung per Weiterleitung wieder auf. */
export async function completeUserRedirect(): Promise<AppUser | null> {
  try {
    const ergebnis = await getRedirectResult(getFirebaseAuth())
    return ergebnis ? toAppUser(ergebnis.user) : null
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    throw new AuthError(FEHLERTEXT[code] ?? 'Anmeldung fehlgeschlagen.')
  }
}

/**
 * Anmeldung mit einem festen Testkonto – nur gegen den Auth-Emulator.
 *
 * Die Anbieter-Anmeldung braucht Google-Infrastruktur, die in automatisierten
 * Durchläufen nicht erreichbar ist. Damit der Rest der App trotzdem prüfbar
 * bleibt, gibt es diesen Weg; im Produktionsbuild ist er abgeschaltet.
 */
export async function signInTestAccount(email = 'testperson@example.ch'): Promise<AppUser> {
  if (!EMULATOR_MODE) throw new AuthError('Testkonten gibt es nur im Emulator.')
  const { user } = await signInWithEmailAndPassword(getFirebaseAuth(), email, 'testtest')
  return toAppUser(user) as AppUser
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(getFirebaseAuth())
  } catch {
    /* Abmelden darf nie fehlschlagen lassen */
  }
}

export async function signOutModerator(): Promise<void> {
  try {
    await signOut(getFirebaseAuth())
  } catch {
    /* Abmelden darf nie fehlschlagen lassen */
  }
}
