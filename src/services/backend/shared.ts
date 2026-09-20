/**
 * Gemeinsames Fundament beider Datenquellen.
 *
 * `ApiError` muss von beiden geworfen werden, weil die Stores darauf prüfen –
 * zwei getrennte Klassen würden `instanceof` stillschweigend scheitern lassen.
 */

export type ApiErrorCode =
  | 'abgebrochen'
  | 'kein-treffer'
  | 'nicht-verifiziert'
  | 'ungueltig'
  | 'speicher'
  /** Serverseitig abgelehnt – meist eine Security Rule. */
  | 'verweigert'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(message: string, code: ApiErrorCode) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError('Vorgang abgebrochen.', 'abgebrochen'))
      return
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      window.clearTimeout(timer)
      reject(new ApiError('Vorgang abgebrochen.', 'abgebrochen'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export const between = (min: number, max: number) => min + Math.random() * (max - min)

/** Aufbewahrungsfrist für Chatverläufe – gilt für beide Datenquellen. */
export const RETENTION_MS = 72 * 60 * 60 * 1000

/** Wie viele Nachrichten eine Meldung mitnimmt. */
export const EXCERPT_LENGTH = 8

/** Sehr grosszügige Prüfung – Formate unterscheiden sich pro Land. */
export function normalizePhone(input: string): string | null {
  const roh = input.replace(/[\s/.-]/g, '')
  if (/^0\d{9}$/.test(roh)) return `+41${roh.slice(1)}` // CH-Mobilnummer ohne Vorwahl
  if (/^\+\d{9,15}$/.test(roh)) return roh
  return null
}

export function maskPhone(phone: string): string {
  const sichtbar = phone.slice(-2)
  const prefix = phone.slice(0, 3)
  return `${prefix} •• ••• •• ${sichtbar}`
}
