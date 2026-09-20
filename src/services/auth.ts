import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type AuthProvider,
  type User,
} from 'firebase/auth'
import { MODERATOR_UID, getFirebaseAuth } from './firebase'

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

/** Anmeldung über Google oder Apple im Popup-Fenster. */
export async function signInWithProvider(anbieter: OAuthAnbieter): Promise<ModeratorAccess> {
  try {
    await setPersistence(getFirebaseAuth(), browserLocalPersistence)
    const { user } = await signInWithPopup(getFirebaseAuth(), providerFor(anbieter))
    return await pruefeOderAbmelden(user)
  } catch (error) {
    if (error instanceof AuthError) throw error
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    throw new AuthError(FEHLERTEXT[code] ?? 'Anmeldung fehlgeschlagen.')
  }
}

export async function signOutModerator(): Promise<void> {
  try {
    await signOut(getFirebaseAuth())
  } catch {
    /* Abmelden darf nie fehlschlagen lassen */
  }
}
