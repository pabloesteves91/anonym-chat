// Spielt die Einträge aus scripts/neuigkeiten-start.json in die Neuigkeiten
// ein. Läuft im Ablauf "Neuigkeiten einspielen"
// (.github/workflows/neuigkeiten.yml), nicht lokal.
//
// Nur anlegen, nie überschreiben: Gibt es einen Eintrag mit derselben
// Kennung schon, bleibt er, wie er ist – auch wenn ihn die Verwaltung
// inzwischen bearbeitet hat. Geprüft wird wie in firestore.rules.
//
// Braucht GOOGLE_APPLICATION_CREDENTIALS (Dienstkonto) und die Pakete der
// Funktionen (npm ci --prefix functions).

import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

// Als Verwaltung eingetragen, damit das Protokoll in Discord sagt, von wem.
const VERWALTUNG = 'RwwpyDrsJldCIx38BcBHVsgTXc32'
const ARTEN = ['neu', 'verbessert', 'behoben']

function abbrechen(text) {
  console.error(`::error::${text}`)
  process.exit(1)
}

function pruefen(e) {
  if (typeof e.id !== 'string' || !/^[a-z0-9-]{3,80}$/.test(e.id)) return 'Kennung fehlt oder ist ungültig'
  if (typeof e.titel !== 'string' || !e.titel.trim() || e.titel.length > 100) return 'Titel fehlt oder ist zu lang'
  if (typeof e.text !== 'string' || !e.text.trim() || e.text.length > 2000) return 'Text fehlt oder ist zu lang'
  if (!ARTEN.includes(e.art)) return 'Art gibt es nicht'
  if (typeof e.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.datum)) return 'Datum ist ungültig'
  if (e.version !== null && !(typeof e.version === 'string' && /^[0-9a-f]{7}$/.test(e.version))) return 'Version ist ungültig'
  return null
}

const eintraege = JSON.parse(await readFile(new URL('./neuigkeiten-start.json', import.meta.url), 'utf8'))
if (!Array.isArray(eintraege)) abbrechen('neuigkeiten-start.json muss eine Liste sein.')
for (const e of eintraege) {
  const fehler = pruefen(e)
  if (fehler) abbrechen(`${e.id ?? '?'}: ${fehler}`)
}

initializeApp({ credential: applicationDefault(), projectId: 'anonym-chat-223af' })
const db = getFirestore()

for (const { id, ...e } of eintraege) {
  try {
    await db.collection('neuigkeiten').doc(id).create({ ...e, veroeffentlicht: true, geaendertVon: VERWALTUNG })
    console.log(`${id}: angelegt.`)
  } catch (fehler) {
    // 6 = ALREADY_EXISTS
    if (fehler?.code === 6) console.log(`${id}: besteht schon, bleibt unverändert.`)
    else throw fehler
  }
}
console.log('Fertig.')
