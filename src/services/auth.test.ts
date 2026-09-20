import { describe, expect, it } from 'vitest'
import { getModeratorAccess } from './auth'

describe('Moderationszugang', () => {
  it('ist im Prototyp offen und sagt das auch', async () => {
    // Wenn dieser Test rot wird, weil eine Anmeldung eingebaut wurde:
    // erwarteten Wert anpassen – und den Hinweis in der Ansicht entfernen.
    await expect(getModeratorAccess()).resolves.toEqual({ erlaubt: true, mode: 'offen' })
  })
})
