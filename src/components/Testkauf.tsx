import { useState } from 'react'
import { Button, Note, Panel } from './ui'
import { starteTestkauf } from '../services/kasse'

/**
 * TESTKAUF – vorübergehend, nur für die Verwaltung. Auf Zuruf entfernen
 * (siehe functions/src/testkauf.ts).
 */
export function Testkauf() {
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  return (
    <Panel className="flex flex-col gap-3 border-dashed p-5">
      <p className="label-caps text-signal">Nur Verwaltung · vorübergehend</p>
      <h2 className="font-display text-xl font-semibold">Testkauf mit echtem Geld</h2>
      <p className="text-sm text-muted">
        Das Testprodukt aus dem Live-Konto. Es wird wirklich abgebucht, setzt aber keinen Tarif – die Zahlung erscheint
        nur in #payments. Danach bei Stripe zurückerstatten.
      </p>
      {fehler ? <Note tone="warn">{fehler}</Note> : null}
      <div>
        <Button
          disabled={laeuft}
          onClick={() => {
            setFehler(null)
            setLaeuft(true)
            starteTestkauf().catch((e) => {
              setFehler(e instanceof Error ? e.message : 'Der Testkauf konnte nicht gestartet werden.')
              setLaeuft(false)
            })
          }}
        >
          {laeuft ? 'Weiter zur Kasse …' : 'Testkauf starten'}
        </Button>
      </div>
    </Panel>
  )
}
