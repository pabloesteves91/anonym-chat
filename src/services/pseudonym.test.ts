import { describe, expect, it } from 'vitest'
import {
  ADJEKTIV_STAMM,
  TIERE_MAENNLICH,
  TIERE_WEIBLICH,
  generatePseudonym,
} from './pseudonym'
import { NAME_MAX, validateDisplayName } from './wordFilter'

/**
 * Der Name ist im Chat das Einzige, was über das Gegenüber etwas aussagt.
 * Er muss zur Angabe passen, grammatikalisch stimmen – und die eigene
 * Namensprüfung bestehen, sonst erzeugt der Dienst Namen, die er selbst
 * ablehnen würde.
 */
describe('generatePseudonym', () => {
  const vieleNamen = (geschlecht: 'weiblich' | 'maennlich' | null) =>
    Array.from({ length: 300 }, () => generatePseudonym(geschlecht))

  it('gibt weiblichen Konten eine weibliche Form', () => {
    for (const name of vieleNamen('weiblich')) {
      const [adjektiv] = name.split(' ')
      expect(adjektiv.endsWith('e')).toBe(true)
      expect(adjektiv.endsWith('er')).toBe(false)
    }
  })

  it('gibt männlichen Konten eine männliche Form', () => {
    for (const name of vieleNamen('maennlich')) {
      expect(name.split(' ')[0].endsWith('er')).toBe(true)
    }
  })

  it('mischt die beiden Tierlisten nicht', () => {
    const weiblich = new Set(vieleNamen('weiblich').map((n) => n.split(' ')[1]))
    const maennlich = new Set(vieleNamen('maennlich').map((n) => n.split(' ')[1]))
    for (const tier of weiblich) expect(maennlich.has(tier)).toBe(false)
  })

  it('hält die Form Adjektiv + Tier + vierstellige Zahl ein', () => {
    for (const geschlecht of ['weiblich', 'maennlich', null] as const) {
      for (const name of vieleNamen(geschlecht)) {
        expect(name).toMatch(/^[A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+ \d{4}$/)
      }
    }
  })

  it('fällt ohne Angabe auf die männliche Form zurück', () => {
    // Der kurze Moment zwischen Kontoanlage und Angabe im Profil.
    for (const name of vieleNamen(null)) {
      expect(name.split(' ')[0].endsWith('er')).toBe(true)
    }
  })

  it('bietet genug Auswahl, um nicht ständig zu wiederholen', () => {
    expect(ADJEKTIV_STAMM.length * TIERE_WEIBLICH.length).toBeGreaterThan(1000)
    expect(ADJEKTIV_STAMM.length * TIERE_MAENNLICH.length).toBeGreaterThan(1000)
    expect(new Set(vieleNamen('weiblich')).size).toBeGreaterThan(200)
  })
})

/**
 * Nicht stichprobenartig, sondern vollständig: Eine einzige Kombination,
 * die durchfällt, wäre ein Konto mit einem Namen, den die App im selben
 * Atemzug für unzulässig erklärt.
 */
describe('jede mögliche Kombination besteht die Namensprüfung', () => {
  const alle = [
    ...ADJEKTIV_STAMM.flatMap((stamm) => TIERE_MAENNLICH.map((tier) => `${stamm}er ${tier} 4417`)),
    ...ADJEKTIV_STAMM.flatMap((stamm) => TIERE_WEIBLICH.map((tier) => `${stamm}e ${tier} 4417`)),
  ]

  it('prüft eine vierstellige Zahl an Kombinationen', () => {
    expect(alle.length).toBeGreaterThan(2000)
  })

  it('bleibt überall innerhalb der erlaubten Länge', () => {
    for (const name of alle) expect(name.length).toBeLessThanOrEqual(NAME_MAX)
  })

  it('löst nirgends den Wortfilter aus', () => {
    const abgelehnt = alle.filter((name) => !validateDisplayName(name).ok)
    expect(abgelehnt).toEqual([])
  })
})
