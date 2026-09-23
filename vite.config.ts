import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

/**
 * Kennung des Builds.
 *
 * Ohne sie lässt sich von aussen nicht sagen, welche Fassung jemand gerade
 * im Browser hat – und auf einer statisch ausgelieferten Seite hält sich
 * ein alter Zwischenspeicher hartnäckig. Steht die Kennung im Fussbereich,
 * ist die Frage "hast du schon die neue Version?" in einem Blick geklärt.
 */
function buildKennung(): string {
  const ausCI = process.env.GITHUB_SHA
  if (ausCI) return ausCI.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'lokal'
  }
}

/**
 * Die letzten ausgerollten Fassungen – zur Auswahl bei den Neuigkeiten.
 *
 * Aus der Git-Geschichte: Kennung (wie im Fussbereich), Datum, Betreff.
 * Die erste ist die, die gerade gebaut wird. Der Pages-Ablauf holt dafür
 * die letzten 30 Commits (fetch-depth); lokal reicht das Repository.
 */
function buildVersionen(): { id: string; datum: string; titel: string }[] {
  try {
    return execSync('git log -n 30 --format=%H%x1f%cI%x1f%s', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((zeile) => {
        const [hash, datum, titel] = zeile.split('\x1f')
        return { id: hash.slice(0, 7), datum, titel }
      })
  } catch {
    return []
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_ID__: JSON.stringify(buildKennung()),
    __BUILD_ZEIT__: JSON.stringify(new Date().toISOString()),
    __VERSIONEN__: JSON.stringify(buildVersionen()),
  },
})
