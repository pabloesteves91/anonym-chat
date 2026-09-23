// Richtet den Moderationsserver auf Discord ein. Läuft im Ablauf
// "Discord einrichten" (.github/workflows/discord.yml), nicht lokal.
//
// Legt an, was fehlt, und lässt stehen, was schon da ist – beliebig oft
// startbar:
//   Kategorie  NØNE Moderation
//   #meldungen  nur lesen, Webhook "NØNE"
//   #support    nur lesen, Webhook "NØNE"
//   #mod-chat   zum Reden
//
// Die Webhook-Adressen werden nie ausgegeben. Sie landen in zwei Dateien
// unter $RUNNER_TEMP; der Ablauf schreibt sie von dort in den Secret
// Manager und löscht die Dateien.
//
// Braucht: DISCORD_BOT_TOKEN, DISCORD_SERVER_ID, RUNNER_TEMP.

import { readFile, writeFile } from 'node:fs/promises'

// Umlenkbar nur für den Test gegen eine nachgebaute API.
const API = process.env.DISCORD_API ?? 'https://discord.com/api/v10'
const TOKEN = process.env.DISCORD_BOT_TOKEN?.trim()
const SERVER = process.env.DISCORD_SERVER_ID?.trim()
const AUSGABE = process.env.RUNNER_TEMP

const KATEGORIE = 'NØNE Moderation'
const WEBHOOK_NAME = 'NØNE'

// Berechtigungsbits, https://discord.com/developers/docs/topics/permissions
const SEND_MESSAGES = 1n << 11n
const MANAGE_MESSAGES = 1n << 13n

const KANAELE = [
  {
    name: 'meldungen',
    thema: 'Neue Meldungen aus dem Chat. Nur Benachrichtigungen – gelesen und entschieden wird in der Moderation.',
    nurLesen: true,
    webhook: 'meldungen',
    hinweis:
      '**Hier landen neue Meldungen.**\nJede Nachricht nennt nur Grund und Zeitpunkt – kein Pseudonym, kein Verlauf. Details und Entscheidung in der Moderation (Link in jeder Nachricht). Mit ✅ reagieren, wenn du eine übernimmst.',
  },
  {
    name: 'support',
    thema: 'Neue Supportanfragen und Antworten im Supportchat. Nur Benachrichtigungen.',
    nurLesen: true,
    webhook: 'support',
    hinweis:
      '**Hier landen neue Supportanfragen und Antworten im Supportchat.**\nJede Nachricht nennt nur das Thema – den Text liest du in der Moderation. Mit ✅ reagieren, wenn du eine übernimmst.',
  },
  {
    name: 'mod-chat',
    thema: 'Absprachen im Team. Keine Namen, Nummern oder Ausweisdaten von Nutzerinnen und Nutzern hier hinein.',
    nurLesen: false,
    hinweis:
      '**Absprachen im Team.**\nBitte keine persönlichen Daten aus der Moderation hierher kopieren – kein Pseudonym zusammen mit Details, keine Ausweisdaten, keine Screenshots von Verläufen. Discord ist ein Dienst ausserhalb der EU.',
  },
]

function abbrechen(text) {
  console.error(`::error::${text}`)
  process.exit(1)
}

if (!TOKEN) abbrechen('Secret DISCORD_BOT_TOKEN fehlt. Anleitung: docs/discord.md')
if (!SERVER || !/^\d+$/.test(SERVER)) abbrechen('Secret DISCORD_SERVER_ID fehlt oder ist keine Zahl. Anleitung: docs/discord.md')
if (!AUSGABE) abbrechen('RUNNER_TEMP fehlt – das Skript läuft nur im GitHub-Ablauf.')

async function discord(methode, pfad, inhalt) {
  for (let versuch = 0; versuch < 5; versuch++) {
    const antwort = await fetch(API + pfad, {
      method: methode,
      headers: {
        Authorization: `Bot ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/pabloesteves91/anonym-chat, 1)',
      },
      body: inhalt === undefined ? undefined : JSON.stringify(inhalt),
    })
    if (antwort.status === 429) {
      const { retry_after = 1 } = await antwort.json().catch(() => ({}))
      await new Promise((r) => setTimeout(r, Math.ceil(retry_after * 1000) + 100))
      continue
    }
    if (antwort.status === 204) return null
    const daten = await antwort.json().catch(() => null)
    if (!antwort.ok) {
      const grund = daten?.message ?? antwort.statusText
      if (antwort.status === 401) abbrechen('Discord lehnt den Bot-Token ab. Token im Developer Portal neu erzeugen und das Secret ersetzen.')
      if (antwort.status === 403 || antwort.status === 404) {
        abbrechen(`Kein Zugriff (${methode} ${pfad}: ${grund}). Ist der Bot im Server und hat er die Rechte aus docs/discord.md?`)
      }
      abbrechen(`Discord: ${methode} ${pfad} → ${antwort.status} ${grund}`)
    }
    return daten
  }
  abbrechen('Discord bremst zu stark (429). Später erneut starten.')
}

const server = await discord('GET', `/guilds/${SERVER}`)
const bot = await discord('GET', '/users/@me')
console.log(`Server: ${server.name}`)

let kanaele = await discord('GET', `/guilds/${SERVER}/channels`)

let kategorie = kanaele.find((k) => k.type === 4 && k.name === KATEGORIE)
if (kategorie) {
  console.log(`Kategorie „${KATEGORIE}" besteht.`)
} else {
  kategorie = await discord('POST', `/guilds/${SERVER}/channels`, { name: KATEGORIE, type: 4 })
  console.log(`Kategorie „${KATEGORIE}" angelegt.`)
}

const icon = `data:image/png;base64,${(await readFile(new URL('../public/icon-192.png', import.meta.url))).toString('base64')}`

for (const vorgabe of KANAELE) {
  // Nur-Lesen: @everyone darf nicht schreiben (reagieren schon), der Bot
  // schon – er stellt den Hinweis ein. Webhooks betrifft das nicht.
  const rechte = vorgabe.nurLesen
    ? [
        { id: SERVER, type: 0, allow: '0', deny: String(SEND_MESSAGES) },
        { id: bot.id, type: 1, allow: String(SEND_MESSAGES | MANAGE_MESSAGES), deny: '0' },
      ]
    : []

  let kanal = kanaele.find((k) => k.type === 0 && k.name === vorgabe.name)
  const neu = !kanal
  if (neu) {
    kanal = await discord('POST', `/guilds/${SERVER}/channels`, {
      name: vorgabe.name,
      type: 0,
      topic: vorgabe.thema,
      parent_id: kategorie.id,
      permission_overwrites: rechte,
    })
    console.log(`#${vorgabe.name} angelegt.`)
  } else {
    await discord('PATCH', `/channels/${kanal.id}`, {
      topic: vorgabe.thema,
      parent_id: kategorie.id,
      permission_overwrites: rechte.length ? rechte : kanal.permission_overwrites,
    })
    console.log(`#${vorgabe.name} besteht, Thema und Rechte aufgefrischt.`)
  }

  if (neu) {
    const nachricht = await discord('POST', `/channels/${kanal.id}/messages`, {
      content: vorgabe.hinweis,
      allowed_mentions: { parse: [] },
    })
    await discord('PUT', `/channels/${kanal.id}/pins/${nachricht.id}`)
  }

  if (vorgabe.webhook) {
    const vorhandene = await discord('GET', `/channels/${kanal.id}/webhooks`)
    let webhook = vorhandene.find((w) => w.name === WEBHOOK_NAME && w.token)
    if (webhook) {
      console.log(`  Webhook in #${vorgabe.name} besteht.`)
    } else {
      webhook = await discord('POST', `/channels/${kanal.id}/webhooks`, { name: WEBHOOK_NAME, avatar: icon })
      console.log(`  Webhook in #${vorgabe.name} angelegt.`)
    }
    const adresse = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`
    // Für den Fall, dass doch einmal etwas ins Protokoll gerät.
    console.log(`::add-mask::${webhook.token}`)
    await writeFile(`${AUSGABE}/discord-${vorgabe.webhook}.url`, adresse, { mode: 0o600 })
  }

  kanaele = await discord('GET', `/guilds/${SERVER}/channels`)
}

console.log('Fertig. Die Webhook-Adressen gehen jetzt in den Secret Manager.')
