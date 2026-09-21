import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage'
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions'

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

// Wer moderieren oder verwalten darf, steht in `services/roles.ts`.

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
  apple: true,
} as const

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null
let functions: Functions | null = null

function getApp(): FirebaseApp {
  app ??= initializeApp(firebaseConfig)
  return app
}

/**
 * Adresse des Auth-Emulators, etwa `http://127.0.0.1:9099`.
 *
 * Gesetzt über `VITE_AUTH_EMULATOR` – nur für die Entwicklung. Im
 * Produktionsbuild ist die Variable leer, dann spricht die App mit dem
 * echten Firebase. Testkonten gibt es keine: Wer hier chattet, hat die
 * Verifizierung durchlaufen.
 */
const EMULATOR = import.meta.env.VITE_AUTH_EMULATOR as string | undefined

/** Lädt Firebase erst beim ersten Zugriff, nicht schon beim Laden der Seite. */
export function getFirebaseAuth(): Auth {
  if (auth) return auth
  auth = getAuth(getApp())
  if (EMULATOR) {
    connectAuthEmulator(auth, EMULATOR, { disableWarnings: true })
  }
  return auth
}

/** Datenbank. Emulatorports kommen aus der Umgebung, sonst echtes Firebase. */
export function getDb(): Firestore {
  if (db) return db
  db = getFirestore(getApp())
  const host = import.meta.env.VITE_FIRESTORE_EMULATOR as string | undefined
  if (host) {
    const [name, port] = host.split(':')
    connectFirestoreEmulator(db, name, Number(port))
  }
  return db
}

/**
 * Serverfunktionen – heute nur die Kasse.
 *
 * Dieselbe Region wie in `functions/src/index.ts`: Steht hier eine andere,
 * ruft der Browser ins Leere.
 */
export function getServerFunctions(): Functions {
  if (functions) return functions
  functions = getFunctions(getApp(), 'europe-west6')
  const host = import.meta.env.VITE_FUNCTIONS_EMULATOR as string | undefined
  if (host) {
    const [name, port] = host.split(':')
    connectFunctionsEmulator(functions, name, Number(port))
  }
  return functions
}

export function getFileStorage(): FirebaseStorage {
  if (storage) return storage
  storage = getStorage(getApp())
  const host = import.meta.env.VITE_STORAGE_EMULATOR as string | undefined
  if (host) {
    const [name, port] = host.split(':')
    connectStorageEmulator(storage, name, Number(port))
  }
  return storage
}
