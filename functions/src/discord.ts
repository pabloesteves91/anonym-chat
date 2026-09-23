import { defineSecret } from 'firebase-functions/params'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'
import { BASIS_URL } from './tarife.js'

/**
 * Benachrichtigungen an den Moderationsserver auf Discord.
 *
 * Warum hier und nicht im Browser: Wer eine Webhook-Adresse kennt, kann in
 * den Kanal schreiben. Im Browser wäre sie für alle lesbar. Hier liegt sie
 * im Secret Manager (`DISCORD_WEBHOOK_MELDUNGEN`, `DISCORD_WEBHOOK_SUPPORT`),
 * gesetzt vom Ablauf "Discord einrichten".
 *
 * Was nach Discord geht, ist bewusst dünn: Art, Kategorie, Zeitpunkt und ein
 * Link in die Moderation. Kein Pseudonym, kein Text, kein Verlauf, kein
 * Anhang. Discord ist ein Dienst in den USA; gelesen wird in der Moderation,
 * wo Zugriffe protokolliert und Daten gelöscht werden.
 *
 * Fehlt ein Webhook oder steht noch der Platzhalter drin, wird nichts
 * gesendet – die Meldung selbst ist davon nie betroffen.
 */

const DISCORD_WEBHOOK_MELDUNGEN = defineSecret('DISCORD_WEBHOOK_MELDUNGEN')
const DISCORD_WEBHOOK_SUPPORT = defineSecret('DISCORD_WEBHOOK_SUPPORT')

// Die Datenbank liegt in eur3; Firestore-Auslöser laufen in einer Region
// innerhalb dieses Verbunds.
export const REGION = 'europe-west1'

const MODERATION_URL = `${BASIS_URL}/#/admin`

const FARBE_MELDUNG = 0x9e4130
const FARBE_SUPPORT = 0x4ec4b0

// Abgeschrieben aus src/services/types.ts und src/services/support.ts – die
// Funktionen sind ein eigenes Paket und können die App nicht importieren.
export const GRUENDE: Record<string, string> = {
  belaestigung: 'Belästigung oder Beleidigung',
  sexuell: 'Sexuelle Inhalte',
  spam: 'Spam oder Werbung',
  minderjaehrig: 'Person ist minderjährig',
  sonstiges: 'Sonstiges',
}

export const THEMEN: Record<string, string> = {
  geschlecht: 'Geschlechtsangabe korrigieren',
  anzeigename: 'Anzeigename',
  'konto-loeschen': 'Konto löschen',
  tarif: 'Tarif und Zahlung',
  gesperrt: 'Mein Konto ist gesperrt',
  sonstiges: 'Etwas anderes',
}

const WEBHOOK = /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/

export interface Einbettung {
  title: string
  description?: string
  color: number
  fields?: { name: string; value: string; inline?: boolean }[]
}

export async function senden(adresse: string, einbettung: Einbettung): Promise<void> {
  if (!WEBHOOK.test(adresse)) {
    logger.info('Discord nicht eingerichtet – keine Benachrichtigung gesendet.')
    return
  }
  const antwort = await fetch(adresse, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'NØNE',
      // Nie jemanden anpingen, egal was im Text steht.
      allowed_mentions: { parse: [] },
      embeds: [{ ...einbettung, url: MODERATION_URL, timestamp: new Date().toISOString() }],
    }),
  })
  if (!antwort.ok) {
    // Status ja, Adresse nie: Sie ist das Geheimnis.
    logger.warn(`Discord hat die Benachrichtigung abgelehnt (HTTP ${antwort.status}).`)
  }
}

export const meldungNachDiscord = onDocumentCreated(
  { document: 'reports/{id}', region: REGION, secrets: [DISCORD_WEBHOOK_MELDUNGEN] },
  async (event) => {
    const grund = String(event.data?.get('reason') ?? '')
    const vorrang = grund === 'minderjaehrig'
    await senden(DISCORD_WEBHOOK_MELDUNGEN.value(), {
      title: vorrang ? '🔴 Neue Meldung – Vorrang' : '🚩 Neue Meldung',
      description: `Grund: **${GRUENDE[grund] ?? 'Unbekannt'}**\n→ Zur Moderation`,
      color: FARBE_MELDUNG,
    })
  },
)

export const supportNachDiscord = onDocumentCreated(
  { document: 'support/{id}', region: REGION, secrets: [DISCORD_WEBHOOK_SUPPORT] },
  async (event) => {
    const thema = String(event.data?.get('thema') ?? '')
    await senden(DISCORD_WEBHOOK_SUPPORT.value(), {
      title: '🛟 Neue Supportanfrage',
      description: `Thema: **${THEMEN[thema] ?? 'Unbekannt'}**\n→ Zur Moderation`,
      color: FARBE_SUPPORT,
    })
  },
)

/** Antworten der Person im Supportchat – die der Moderation selbst nicht. */
export const supportAntwortNachDiscord = onDocumentCreated(
  { document: 'support/{id}/nachrichten/{nachrichtId}', region: REGION, secrets: [DISCORD_WEBHOOK_SUPPORT] },
  async (event) => {
    if (event.data?.get('von') !== 'nutzer') return
    await senden(DISCORD_WEBHOOK_SUPPORT.value(), {
      title: '💬 Neue Antwort im Supportchat',
      description: 'Eine Person hat im Supportchat geantwortet.\n→ Zur Moderation',
      color: FARBE_SUPPORT,
    })
  },
)
