import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { senden, type Einbettung } from './discord.js'

export { aboEndeEintrag, betragText, testkaufEintrag, zahlungEintrag } from './zahlungsnachricht.js'

/**
 * Zahlungen im Discord-Kanal #payments.
 *
 * Gemeldet werden neue Zahlungen und beendete Abos – mit Tarif, Betrag und
 * Laufzeit. Die Person nur als Kurzkennung („Konto a1b2c3"), kein Name,
 * keine Mail, keine Kartendaten: Die stehen bei Stripe, nicht hier.
 *
 * Scheitert Discord, geht die Zahlung trotzdem durch – die Benachrichtigung
 * ist Beiwerk, der Tarif das Wesentliche.
 */

export const DISCORD_WEBHOOK_PAYMENTS = defineSecret('DISCORD_WEBHOOK_PAYMENTS')

export async function zahlungMelden(eintrag: Einbettung): Promise<void> {
  try {
    await senden(DISCORD_WEBHOOK_PAYMENTS.value(), eintrag)
  } catch (fehler) {
    logger.warn('Discord #payments nicht erreichbar', { fehler })
  }
}
