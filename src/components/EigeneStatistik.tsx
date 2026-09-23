import { useEffect, useState } from 'react'
import { Panel } from './ui'
import * as api from '../services/api'
import { dauerText, diesenMonat, durchschnittMs, type Statistik } from '../services/feedback'

/**
 * „Deine NØNE Statistik" – nur für dich, nie für andere.
 *
 * Gezählt wird auf dem Server, einmal pro Gespräch. Was andere über dich
 * denken, steht hier nicht, ausser wie oft jemand „Gutes Gespräch" gewählt
 * hat. Keine Rangliste, keine Punkte, kein Vergleich.
 */
export function EigeneStatistik() {
  const [statistik, setStatistik] = useState<Statistik | null>(null)
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    let aktiv = true
    api
      .ladeStatistik()
      .then((s) => aktiv && setStatistik(s))
      .catch(() => aktiv && setFehler(true))
    return () => {
      aktiv = false
    }
  }, [])

  const werte: [string, string][] = statistik
    ? [
        ['Gespräche insgesamt', String(statistik.gespraeche)],
        ['Diesen Monat', String(diesenMonat(statistik))],
        ['Zeit im Gespräch', dauerText(statistik.dauerSummeMs)],
        ['Längstes Gespräch', dauerText(statistik.laengsteMs)],
        ['Durchschnitt', dauerText(durchschnittMs(statistik))],
        ['„Gutes Gespräch" erhalten', String(statistik.gut)],
      ]
    : []

  return (
    <Panel className="flex flex-col gap-3 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Deine NØNE Statistik</h2>
        <p className="mt-1 text-sm text-muted">Nur für dich sichtbar. Jedes Gespräch zählt einmal, egal wie es endete.</p>
      </div>
      {fehler ? (
        <p className="text-sm text-muted">Die Statistik lässt sich gerade nicht laden.</p>
      ) : !statistik ? (
        <p className="label-caps" role="status">
          Wird geladen …
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
          {werte.map(([label, wert]) => (
            <div key={label} className="flex flex-col gap-0.5 bg-surface p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-display text-xl font-semibold">{wert}</dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  )
}
