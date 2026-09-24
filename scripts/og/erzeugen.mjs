// Erzeugt public/og.jpg (1200 × 630) aus scripts/og/vorlage.html.
// Aufruf: node scripts/og/erzeugen.mjs  (braucht Playwright mit Chromium)
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const vorlage = new URL('./vorlage.html', import.meta.url)
const ziel = fileURLToPath(new URL('../../public/og.jpg', import.meta.url))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined })
const seite = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await seite.goto(vorlage.href)
await seite.evaluate(() => document.fonts.ready)
await seite.screenshot({ path: ziel, type: 'jpeg', quality: 88 })
await browser.close()
console.log('geschrieben:', ziel)
