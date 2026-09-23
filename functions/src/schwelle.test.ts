import { describe, expect, it } from 'vitest'
import {
  FENSTER_MS,
  LEERER_STAND,
  SCHWELLE,
  automatischerHinweis,
  hinweisId,
  standAus,
  werteAus,
  type Bewertung,
  type FeedbackStand,
} from './schwelle'

let zaehler = 0
const bewertung = (patch: Partial<Bewertung> = {}): Bewertung => {
  zaehler += 1
  return { id: `fb${zaehler}`, von: `p${zaehler}`, chatId: `chat${zaehler}`, wert: 'unangenehm', at: 1_000_000, echt: true, ...patch }
}

/** Mehrere Bewertungen nacheinander – wie der Auslöser sie verarbeitet. */
function nacheinander(liste: Bewertung[], start: FeedbackStand = LEERER_STAND) {
  let stand = start
  const faelle = []
  for (const b of liste) {
    const ergebnis = werteAus(stand, b)
    stand = ergebnis.stand
    if (ergebnis.fall) faelle.push(ergebnis.fall)
  }
  return { stand, faelle }
}

describe('Schwelle für den automatischen Hinweis', () => {
  it('drei „unangenehm" von drei Personen aus drei Gesprächen ergeben genau einen Fall', () => {
    const { faelle, stand } = nacheinander([bewertung(), bewertung(), bewertung()])
    expect(SCHWELLE).toBe(3)
    expect(faelle).toHaveLength(1)
    expect(faelle[0].anzahl).toBe(3)
    expect(faelle[0].chatIds).toHaveLength(3)
    expect(stand.offen).toEqual([])
    expect(stand.faelle).toBe(1)
  })

  it('zwei Bewertungen derselben Person erreichen keine Schwelle', () => {
    const { faelle, stand } = nacheinander([
      bewertung({ von: 'gleich' }),
      bewertung({ von: 'gleich' }),
      bewertung({ von: 'gleich' }),
      bewertung(),
    ])
    expect(faelle).toHaveLength(0)
    expect(stand.offen).toHaveLength(2)
  })

  it('zählt ein Gespräch nur einmal', () => {
    const { faelle } = nacheinander([bewertung({ chatId: 'x' }), bewertung({ chatId: 'x' }), bewertung()])
    expect(faelle).toHaveLength(0)
  })

  it('die vierte Bewertung erzeugt nicht sofort wieder einen Fall', () => {
    const erst = nacheinander([bewertung(), bewertung(), bewertung()])
    const danach = nacheinander([bewertung()], erst.stand)
    expect(danach.faelle).toHaveLength(0)
    expect(danach.stand.offen).toHaveLength(1)
    // Erst drei weitere, neue Personen ergeben den nächsten Fall.
    const zweiter = nacheinander([bewertung(), bewertung()], danach.stand)
    expect(zweiter.faelle).toHaveLength(1)
    expect(zweiter.faelle[0].nummer).toBe(2)
  })

  it('wer schon zu einem Fall beigetragen hat, zählt nicht noch einmal', () => {
    const erst = nacheinander([bewertung({ von: 'a' }), bewertung({ von: 'b' }), bewertung({ von: 'c' })])
    const wieder = nacheinander(
      [bewertung({ von: 'a' }), bewertung({ von: 'b' }), bewertung({ von: 'c' })],
      erst.stand,
    )
    expect(wieder.faelle).toHaveLength(0)
  })

  it('dieselbe Bewertung zweimal verarbeitet ändert nichts', () => {
    const b = bewertung()
    const einmal = werteAus(LEERER_STAND, b)
    const zweimal = werteAus(einmal.stand, b)
    expect(zweimal.neu).toBe(false)
    expect(zweimal.stand).toBe(einmal.stand)
  })

  it('neutral, gut und Bewertungen ohne echtes Gespräch zählen nicht', () => {
    const { faelle, stand } = nacheinander([
      bewertung({ wert: 'neutral' }),
      bewertung({ wert: 'gut' }),
      bewertung({ echt: false }),
      bewertung(),
      bewertung(),
    ])
    expect(faelle).toHaveLength(0)
    expect(stand.offen).toHaveLength(2)
  })

  it('lässt Altes aus dem Fenster fallen', () => {
    const { faelle } = nacheinander([
      bewertung({ at: 0 }),
      bewertung({ at: 0 }),
      bewertung({ at: FENSTER_MS + 1 }),
    ])
    expect(faelle).toHaveLength(0)
  })

  it('meldet ein „Gutes Gespräch" nur aus einem echten Gespräch', () => {
    expect(werteAus(LEERER_STAND, bewertung({ wert: 'gut' })).gut).toBe(true)
    expect(werteAus(LEERER_STAND, bewertung({ wert: 'gut', echt: false })).gut).toBe(false)
  })

  it('sperrt nie – der Hinweis ist eine offene Meldung ohne Sperrfeld', () => {
    const { faelle } = nacheinander([bewertung(), bewertung(), bewertung()])
    const hinweis = automatischerHinweis('konto1', 'Blauer Falke 1', faelle[0])
    expect(hinweis.status).toBe('offen')
    expect(hinweis.id).toBe(hinweisId('konto1', 1))
    expect(hinweis.reportedId).toBe('konto1')
    expect(hinweis.automatisch.anzahl).toBe(3)
    expect(hinweis.excerpt).toEqual([])
    expect(Object.keys(hinweis)).not.toContain('blocked')
    expect(JSON.stringify(hinweis)).not.toMatch(/gesperrt|blocked|sperre/i)
  })

  it('liest auch einen kaputten Stand verlässlich', () => {
    expect(standAus(undefined)).toEqual(LEERER_STAND)
    expect(standAus({ offen: [{ von: 1 }], faelle: -2, gezaehlt: 'x' })).toEqual(LEERER_STAND)
  })
})
