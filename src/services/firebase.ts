import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

/**
 * Firebase-Anbindung.
 *
 * Die Konfiguration ist bewusst im Repository: Bei Web-Apps ist sie ein
 * öffentlicher Bezeichner, kein Geheimnis. Der Schutz kommt aus den Security
 * Rules (`firestore.rules`, `storage.rules`) und aus der Beschränkung des
 * API-Schlüssels auf die eigenen Domains – nicht daraus, diese Datei zu
 * verstecken.
 *
 * Nicht hierher gehört der Service-Account-Schlüssel: der umgeht jede Regel.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyDv9L5BSW2HIJOocvqZHjyAu7KZmvTnmQc',
  authDomain: 'anonym-chat-223af.firebaseapp.com',
  projectId: 'anonym-chat-223af',
  storageBucket: 'anonym-chat-223af.firebasestorage.app',
  messagingSenderId: '417196431125',
  appId: '1:417196431125:web:4831ec455d5b79064f3b1c',
}

/**
 * Die eine Kennung mit Moderationsrechten. Dieselbe UID steht in den
 * Security Rules – dort entscheidet sie tatsächlich, hier steuert sie nur,
 * was angezeigt wird.
 *
 * Sobald es mehr als eine moderierende Person gibt: auf Custom Claims oder
 * eine Collection `admins/{uid}` umstellen und beide Seiten anpassen.
 */
export const MODERATOR_UID = 'RwwpyDrsJldCIx38BcBHVsgTXc32'

/**
 * Welche Anmeldearten in der Firebase-Konsole aktiviert sind.
 *
 * Steht hier etwas auf `true`, das dort nicht eingerichtet ist, meldet
 * Firebase `auth/operation-not-allowed` – die Oberfläche zeigt den Knopf
 * deshalb nur, wenn beides zusammenpasst.
 */
export const ANMELDEARTEN = {
  passwort: true,
  google: true,
  apple: false,
} as const

let app: FirebaseApp | null = null
let auth: Auth | null = null

/** Lädt Firebase erst, wenn es gebraucht wird – der Chat läuft ohne. */
export function getFirebaseAuth(): Auth {
  app ??= initializeApp(firebaseConfig)
  auth ??= getAuth(app)
  return auth
}
