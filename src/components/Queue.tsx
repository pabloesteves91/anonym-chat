import { useEffect, useState } from 'react'
import { Button, Panel } from './ui'
import { useChat } from '../store/useChat'

/** Warteschlange: ruhiger Suchlauf statt Spinner. */
export function Queue() {
  const cancelSearch = useChat((s) => s.cancelSearch)
  const filter = useChat((s) => s.filter)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <Panel className="p-6 text-center">
      <p className="label-caps">Suche läuft</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Wir verbinden dich mit jemandem</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Gesucht wird unter verifizierten Konten
        {filter.language !== 'egal' ? `, Sprache ${filter.language.toUpperCase()}` : ''}
        {filter.interests.length > 0 ? `, Interessen: ${filter.interests.join(', ')}` : ''}.
      </p>

      <div className="sweep relative mx-auto mt-6 h-0.5 w-full max-w-sm overflow-hidden bg-line" aria-hidden="true" />

      <p aria-live="polite" className="mt-3 font-mono text-xs text-muted">
        {String(seconds).padStart(2, '0')} s
      </p>

      <div className="mt-6">
        <Button onClick={cancelSearch}>Abbrechen</Button>
      </div>
    </Panel>
  )
}
