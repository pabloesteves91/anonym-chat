import { defineConfig } from 'vitest/config'

/**
 * Die Regeln laufen gegen den Firestore-Emulator, nicht gegen jsdom – und
 * nicht bei jedem `npm test`, weil sie einen laufenden Emulator brauchen.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
})
