import { describe, expect, it } from 'vitest'
import { alleGesehen, hatUngelesene, neuesteVersion, pruefeNeuigkeit, sortiert, type Neuigkeit } from './neuigkeiten'

const eintrag = (patch: Partial<Neuigkeit> = {}): Neuigkeit => ({
  id: 'n1',
  titel: 'Gutscheine',
  text: 'Codes auf der Tarifseite.',
  art: 'neu',
  datum: '2026-09-23',
  version: 'c7f1ae6',
  veroeffentlicht: true,
  ...patch,
})

describe('pruefeNeuigkeit', () => {
  const { id: _id, ...gut } = eintrag()
  void _id

  it('lässt einen vollständigen Eintrag durch', () => {
    expect(pruefeNeuigkeit(gut)).toBeNull()
    expect(pruefeNeuigkeit({ ...gut, version: null })).toBeNull()
  })

  it('verlangt Titel und Beschreibung', () => {
    expect(pruefeNeuigkeit({ ...gut, titel: '  ' })).toMatch(/Titel/)
    expect(pruefeNeuigkeit({ ...gut, text: '' })).toMatch(/Beschreibe/)
    expect(pruefeNeuigkeit({ ...gut, titel: 'x'.repeat(101) })).toMatch(/zu lang/)
  })

  it('prüft Datum und Version', () => {
    expect(pruefeNeuigkeit({ ...gut, datum: '23.09.2026' })).toMatch(/Datum/)
    expect(pruefeNeuigkeit({ ...gut, version: 'v1.2' })).toMatch(/Version/)
    expect(pruefeNeuigkeit({ ...gut, version: 'C7F1AE6' })).toMatch(/Version/)
  })
})

describe('Reihenfolge und neueste Version', () => {
  const alt = eintrag({ id: 'alt', datum: '2026-09-01', version: '1111111' })
  const neu = eintrag({ id: 'neu', datum: '2026-09-20', version: '2222222' })
  const ohne = eintrag({ id: 'ohne', datum: '2026-09-22', version: null })
  const entwurf = eintrag({ id: 'entwurf', datum: '2026-09-30', version: '3333333', veroeffentlicht: false })

  it('sortiert neueste zuerst', () => {
    expect(sortiert([alt, ohne, neu]).map((n) => n.id)).toEqual(['ohne', 'neu', 'alt'])
  })

  it('nimmt als neueste Version die des jüngsten veröffentlichten Eintrags mit Version', () => {
    expect(neuesteVersion([alt, neu, ohne, entwurf])).toBe('2222222')
    expect(neuesteVersion([ohne])).toBeNull()
  })
})

describe('neu seit dem letzten Besuch', () => {
  const a = eintrag({ id: 'a' })
  const b = eintrag({ id: 'b' })
  const entwurf = eintrag({ id: 'e', veroeffentlicht: false })

  it('meldet Ungelesenes nur für Veröffentlichtes', () => {
    expect(hatUngelesene([a, b], [])).toBe(true)
    expect(hatUngelesene([a, b], ['a', 'b'])).toBe(false)
    expect(hatUngelesene([a, entwurf], ['a'])).toBe(false)
  })

  it('merkt sich alles Gesehene, Neues vorne', () => {
    expect(alleGesehen([a, b], ['alt'])).toEqual(['a', 'b', 'alt'])
    expect(alleGesehen([a], ['a'])).toEqual(['a'])
  })
})
