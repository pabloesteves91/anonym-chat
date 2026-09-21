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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_ID__: JSON.stringify(buildKennung()),
    __BUILD_ZEIT__: JSON.stringify(new Date().toISOString()),
  },
})
