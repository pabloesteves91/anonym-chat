import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Die reine Logik der Cloud Functions wird hier mitgeprüft; das Paket
    // der Funktionen hat keinen eigenen Testlauf.
    include: ['src/**/*.test.ts', 'functions/src/**/*.test.ts'],
    restoreMocks: true,
  },
})
