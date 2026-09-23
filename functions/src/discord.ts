import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
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
 *
 * Ist ein Supportfall erledigt, verschwinden seine Benachrichtigungen aus
 * `#support` wieder: Der Kanal zeigt, was offen ist, nicht was war. Welche
 * Nachrichten zu welchem Fall gehören, steht in `discordNachrichten/{fall}`
 * – eine Sammlung, an die nur der Server kommt (keine Regel erlaubt den
 * Zugriff aus der App).
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

/** Sendet und gibt die Kennung der Discord-Nachricht zurück – oder null. */
export async function senden(adresse: string, einbettung: Einbettung): Promise<string | null> {
  if (!WEBHOOK.test(adresse)) {
    logger.info('Discord nicht eingerichtet – keine Benachrichtigung gesendet.')
    return null
  }
  // wait=true: Discord antwortet mit der Nachricht, samt Kennung zum Löschen.
  const antwort = await fetch(`${adresse}?wait=true`, {
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
    return null
  }
  const nachricht = (await antwort.json().catch(() => null)) as { id?: string } | null
  return nachricht?.id ?? null
}

/** Löscht eine Nachricht, die über diesen Webhook gesendet wurde. */
async function loeschen(adresse: string, nachrichtId: string): Promise<void> {
  if (!WEBHOOK.test(adresse) || !/^\d+$/.test(nachrichtId)) return
  const antwort = await fetch(`${adresse}/messages/${nachrichtId}`, { method: 'DELETE' })
  // 404: schon von Hand gelöscht – auch recht.
  if (!antwort.ok && antwort.status !== 404) {
    logger.warn(`Discord hat das Löschen abgelehnt (HTTP ${antwort.status}).`)
  }
}

const NACHRICHTEN = 'discordNachrichten'

/** Merkt sich, dass diese Discord-Nachricht zum Supportfall gehört. */
async function merken(fallId: string, nachrichtId: string | null): Promise<void> {
  if (!nachrichtId) return
  await getFirestore()
    .collection(NACHRICHTEN)
    .doc(fallId)
    .set({ ids: FieldValue.arrayUnion(nachrichtId) }, { merge: true })
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
    const id = await senden(DISCORD_WEBHOOK_SUPPORT.value(), {
      title: '🛟 Neue Supportanfrage',
      description: `Thema: **${THEMEN[thema] ?? 'Unbekannt'}**\n→ Zur Moderation`,
      color: FARBE_SUPPORT,
    })
    await merken(event.params.id, id)
  },
)

/** Antworten der Person im Supportchat – die der Moderation selbst nicht. */
export const supportAntwortNachDiscord = onDocumentCreated(
  { document: 'support/{id}/nachrichten/{nachrichtId}', region: REGION, secrets: [DISCORD_WEBHOOK_SUPPORT] },
  async (event) => {
    if (event.data?.get('von') !== 'nutzer') return
    const id = await senden(DISCORD_WEBHOOK_SUPPORT.value(), {
      title: '💬 Neue Antwort im Supportchat',
      description: 'Eine Person hat im Supportchat geantwortet.\n→ Zur Moderation',
      color: FARBE_SUPPORT,
    })
    await merken(event.params.id, id)
  },
)

/** Erledigt: die Benachrichtigungen des Falls aus #support entfernen. */
export const supportErledigtAufraeumen = onDocumentUpdated(
  { document: 'support/{id}', region: REGION, secrets: [DISCORD_WEBHOOK_SUPPORT] },
  async (event) => {
    const vor = event.data?.before.get('status')
    const nach = event.data?.after.get('status')
    if (nach !== 'erledigt' || vor === 'erledigt') return
    const eintrag = getFirestore().collection(NACHRICHTEN).doc(event.params.id)
    const ids = ((await eintrag.get()).get('ids') as string[] | undefined) ?? []
    for (const id of ids) await loeschen(DISCORD_WEBHOOK_SUPPORT.value(), id)
    await eintrag.delete()
  },
)
