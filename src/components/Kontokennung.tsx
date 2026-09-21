import { useState } from 'react'
import { Button, Panel } from './ui'

/**
 * Die eigene Kontokennung, sichtbar und kopierbar.
 *
 * Gegenüber anderen Nutzenden taucht sie nie auf – sie ist der Faden
 * zwischen Konto, Verifizierung und Sperre. Sichtbar ist sie trotzdem, weil
 * man sie braucht: um einen Tarif freischalten zu lassen, um bei einer
 * Rückfrage zu sagen, um welches Konto es geht, und um zu erkennen, ob man
 * gerade mit dem Konto angemeldet ist, das man meint.
 */
export function Kontokennung({ id, hinweis }: { id: string; hinweis?: string }) {
  const [kopiert, setKopiert] = useState(false)

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(id)
      setKopiert(true)
      window.setTimeout(() => setKopiert(false), 2000)
    } catch {
      // Ohne Zwischenablage bleibt die Kennung lesbar – das reicht.
    }
  }

  return (
    <Panel className="flex flex-wrap items-center gap-x-4 gap-y-2 p-5">
      <div className="min-w-0">
        <p className="label-caps">Kennung dieses Kontos</p>
        <p className="mt-1 font-mono text-sm break-all text-ink">{id}</p>
        {hinweis ? <p className="mt-2 max-w-prose text-sm text-muted">{hinweis}</p> : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" onClick={() => void kopieren()}>
          Kopieren
        </Button>
        <span aria-live="polite" className="text-sm text-muted">
          {kopiert ? 'Kopiert.' : ''}
        </span>
      </div>
    </Panel>
  )
}
