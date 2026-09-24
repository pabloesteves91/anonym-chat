import { useEffect, useState } from 'react'
import { Button, Panel } from './ui'
import { GespraechsFeedback } from './GespraechsFeedback'
import {
  ERWEITERUNG_ANGEBOT_NACH_MS,
  ERWEITERUNG_ERNEUT_NACH_MS,
  SUCHSTATUS_TEXT,
  erweiterbar,
  suchstatus,
} from '../services/matching'
import { useChat } from '../store/useChat'

/**
 * Warteschlange: ruhiger Suchlauf statt Spinner.
 *
 * Wie viele gerade warten, steht hier nie – nur eine Stufe in Worten.
 * Dauert es mit Interessenfilter lange, wird angeboten, ohne ihn
 * weiterzusuchen; ohne Zustimmung ändert sich an der Suche nichts.
 */
export function Queue() {
  const cancelSearch = useChat((s) => s.cancelSearch)
  const sucheErweitern = useChat((s) => s.sucheErweitern)
  const filter = useChat((s) => s.filter)
  const erweitert = useChat((s) => s.erweitert)
  const sicht = useChat((s) => s.sicht)
  const [seconds, setSeconds] = useState(0)
  // Ab wann (Sekunden seit Suchbeginn) die Erweiterung angeboten wird.
  const [angebotAb, setAngebotAb] = useState(ERWEITERUNG_ANGEBOT_NACH_MS / 1000)

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const interessenAktiv = filter.interests.length > 0 && !erweitert
  const stufe = suchstatus(
    sicht ? { ...sicht, filterAktiv: interessenAktiv || filter.language !== 'egal' } : null,
  )
  const anbieten = erweiterbar(filter) && !erweitert && seconds >= angebotAb

  return (
    <Panel className="p-6 text-center">
      <p className="label-caps">Suche läuft</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Wir verbinden dich mit jemandem</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Wir suchen unter verifizierten Konten
        {filter.language !== 'egal' ? `, Sprache ${filter.language.toUpperCase()}` : ''}
        {interessenAktiv ? `, Interessen: ${filter.interests.join(', ')}` : ''}
        {erweitert ? ', jetzt ohne Interessenfilter' : ''}.
      </p>

      <div className="sweep relative mx-auto mt-6 h-0.5 w-full max-w-sm overflow-hidden bg-line" aria-hidden="true" />

      <p aria-live="polite" className="mt-3 text-sm font-medium">
        {SUCHSTATUS_TEXT[stufe]}
      </p>
      <p className="mt-1 font-mono text-xs text-muted">{String(seconds).padStart(2, '0')} s</p>

      {anbieten ? (
        <div className="mx-auto mt-5 max-w-md rounded-sm border border-accent/45 bg-accent-soft p-4 text-left">
          <p className="font-medium">Ohne Interessenfilter weitersuchen?</p>
          <p className="mt-1 text-sm text-muted">
            Mit deinen Interessen ist gerade niemand da. Die Sprache bleibt, und blockierte Konten bleiben blockiert.
            Beim nächsten Chat gilt wieder dein Filter.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => void sucheErweitern()}>
              Suche erweitern
            </Button>
            <Button size="sm" onClick={() => setAngebotAb(seconds + ERWEITERUNG_ERNEUT_NACH_MS / 1000)}>
              Weiter warten
            </Button>
          </div>
        </div>
      ) : null}

      <p className="mx-auto mt-4 max-w-md text-sm text-muted">
        Am anderen Ende sitzt eine echte, verifizierte Person, die auch gerade sucht. Zu ruhigen Zeiten kann das
        etwas dauern.
      </p>

      <div className="mx-auto mt-5 max-w-md">
        <GespraechsFeedback kompakt />
      </div>

      <div className="mt-6">
        <Button onClick={cancelSearch}>Abbrechen</Button>
      </div>
    </Panel>
  )
}
