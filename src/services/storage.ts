/**
 * Dünne, defensive Hülle um localStorage.
 *
 * Jeder Zugriff ist in try/catch gekapselt: Die App muss auch bei leerem,
 * gesperrtem oder beschädigtem Storage sauber starten (Privatmodus, ITP,
 * manuell geleerter Speicher). Fehlschläge sind nie fatal – sie führen nur
 * dazu, dass nichts persistiert wird.
 */

const PREFIX = 'vac.v1.'

export const KEYS = {
  user: `${PREFIX}user`,
  requests: `${PREFIX}verifications`,
  sms: `${PREFIX}sms`,
  transcripts: `${PREFIX}transcripts`,
  accessLog: `${PREFIX}accesslog`,
  /** Präfix für Bildvorschauen im Sitzungsspeicher. */
  preview: `${PREFIX}preview.`,
  reports: `${PREFIX}reports`,
  blocked: `${PREFIX}blocked`,
  selfBlocked: `${PREFIX}selfblocked`,
  codex: `${PREFIX}codex`,
  theme: `${PREFIX}theme`,
} as const

let available: boolean | null = null

export function isStorageAvailable(): boolean {
  if (available !== null) return available
  try {
    const probe = `${PREFIX}probe`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    available = true
  } catch {
    available = false
  }
  return available
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    // Kaputter Eintrag: einmal aufräumen, danach Fallback benutzen.
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* egal */
    }
    return fallback
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function remove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* egal */
  }
}

/**
 * Sitzungsspeicher für die Ausweis- und Selfie-Vorschauen.
 *
 * Bewusst sessionStorage statt localStorage: die Bilder überleben einen
 * Reload im selben Tab, aber nicht das Schliessen des Browsers. Ausweisbilder
 * gehören nicht in dauerhaften Speicher – in Phase 2 liegen sie ohnehin beim
 * Prüfanbieter und nie hier.
 */
export function readSessionString(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSessionString(key: string, value: string): boolean {
  try {
    window.sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeSession(key: string): void {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    /* egal */
  }
}

export function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* egal */
  }
}
