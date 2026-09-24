// Hinterlegt die Webhooks für die Discord-Benachrichtigungen. Läuft im
// Ablauf "Discord einrichten" (.github/workflows/discord.yml), nicht lokal.
//
// Die Kanäle gibt es schon – angelegt und eingerichtet von Hand. Dieses
// Skript fasst sie nicht an: kein Umbenennen, kein Verschieben, keine
// Rechte. Es legt in jedem der drei Kanäle einen Webhook "NØNE" an (oder
// nimmt den vorhandenen) und sonst nichts. Beliebig oft startbar.
//
// Die Webhook-Adressen werden nie ausgegeben. Sie landen in drei Dateien
// unter $RUNNER_TEMP; der Ablauf schreibt sie von dort in den Secret
// Manager und löscht die Dateien.
//
// Braucht: DISCORD_BOT_TOKEN, DISCORD_KANAL_MELDUNGEN, DISCORD_KANAL_SUPPORT,
// DISCORD_KANAL_LOG, DISCORD_KANAL_PAYMENTS, RUNNER_TEMP. Der Bot braucht in allen drei Kanälen
// "Kanal ansehen" und "Webhooks verwalten".

import { readFile, writeFile } from 'node:fs/promises'

// Umlenkbar nur für den Test gegen eine nachgebaute API.
const API = process.env.DISCORD_API ?? 'https://discord.com/api/v10'
const TOKEN = process.env.DISCORD_BOT_TOKEN?.trim()
const AUSGABE = process.env.RUNNER_TEMP
const WEBHOOK_NAME = 'NØNE'

const KANAELE = [
  { datei: 'meldungen', id: process.env.DISCORD_KANAL_MELDUNGEN?.trim() },
  { datei: 'support', id: process.env.DISCORD_KANAL_SUPPORT?.trim() },
  { datei: 'log', id: process.env.DISCORD_KANAL_LOG?.trim() },
  { datei: 'payments', id: process.env.DISCORD_KANAL_PAYMENTS?.trim() },
]

function abbrechen(text) {
  console.error(`::error::${text}`)
  process.exit(1)
}

if (!TOKEN) abbrechen('Secret DISCORD_BOT_TOKEN fehlt. Anleitung: docs/discord.md')
for (const k of KANAELE) {
  if (!k.id || !/^\d+$/.test(k.id)) abbrechen(`Kanal-ID für ${k.datei} fehlt oder ist keine Zahl – siehe .github/workflows/discord.yml (Log: Secret DISCORD_KANAL_LOG, Payments: Secret DISCORD_KANAL_PAYMENT)`)
}
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
    const daten = await antwort.json().catch(() => null)
    if (!antwort.ok) {
      const grund = daten?.message ?? antwort.statusText
      if (antwort.status === 401) abbrechen('Discord lehnt den Bot-Token ab. Token im Developer Portal neu erzeugen und das Secret ersetzen.')
      if (antwort.status === 403 || antwort.status === 404) {
        abbrechen(
          `Kein Zugriff (${methode} ${pfad}: ${grund}). Im Kanal → Bearbeiten → Berechtigungen der Rolle des Bots „Kanal ansehen" und „Webhooks verwalten" erlauben. Stimmt die Kanal-ID?`,
        )
      }
      abbrechen(`Discord: ${methode} ${pfad} → ${antwort.status} ${grund}`)
    }
    return daten
  }
  abbrechen('Discord bremst zu stark (429). Später erneut starten.')
}

const icon = `data:image/png;base64,${(await readFile(new URL('../public/icon-192.png', import.meta.url))).toString('base64')}`

for (const k of KANAELE) {
  const kanal = await discord('GET', `/channels/${k.id}`)
  const vorhandene = await discord('GET', `/channels/${k.id}/webhooks`)
  let webhook = vorhandene.find((w) => w.name === WEBHOOK_NAME && w.token)
  if (webhook) {
    console.log(`#${kanal.name}: Webhook besteht.`)
  } else {
    webhook = await discord('POST', `/channels/${k.id}/webhooks`, { name: WEBHOOK_NAME, avatar: icon })
    console.log(`#${kanal.name}: Webhook angelegt.`)
  }
  // Für den Fall, dass doch einmal etwas ins Protokoll gerät.
  console.log(`::add-mask::${webhook.token}`)
  await writeFile(`${AUSGABE}/discord-${k.datei}.url`, `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`, {
    mode: 0o600,
  })
}

console.log('Fertig. Die Webhook-Adressen gehen jetzt in den Secret Manager.')
