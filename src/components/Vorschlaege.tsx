import { useState } from 'react'
import { KATEGORIE_LABEL, zieheVorschlaege, type Starter } from '../content/gespraechsstarter'

/**
 * NØNE Vorschläge: drei Gesprächsstarter zur Auswahl.
 *
 * Ein Klick setzt den Satz ins Eingabefeld – senden muss man selbst. So
 * bleibt jede Nachricht eine eigene Entscheidung, und man kann den Satz
 * noch anpassen.
 */
export function Vorschlaege({ onWaehlen, onSchliessen }: { onWaehlen: (text: string) => void; onSchliessen: () => void }) {
  const [liste, setListe] = useState<Starter[]>(() => zieheVorschlaege())

  return (
    <div className="border-t border-line bg-raised px-4 py-3" role="region" aria-label="NØNE Vorschläge">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="label-caps">NØNE Vorschläge</p>
        <button
          type="button"
          onClick={onSchliessen}
          className="rounded-sm px-2 py-1 text-sm text-muted hover:text-ink"
          aria-label="Vorschläge schliessen"
        >
          ✕
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {liste.map((vorschlag) => (
          <li key={vorschlag.text}>
            <button
              type="button"
              onClick={() => onWaehlen(vorschlag.text)}
              className="flex w-full flex-col gap-0.5 rounded-sm border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-accent"
            >
              <span className="font-mono text-[0.6875rem] tracking-wide text-muted uppercase">
                {KATEGORIE_LABEL[vorschlag.kategorie]}
              </span>
              <span>{vorschlag.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Wird ins Eingabefeld gesetzt – gesendet wird erst, wenn du sendest.</p>
        <button
          type="button"
          onClick={() => setListe(zieheVorschlaege(undefined, liste.map((v) => v.text)))}
          className="shrink-0 rounded-sm px-2 py-1 text-sm font-medium text-accent-strong underline underline-offset-4 hover:text-ink"
        >
          Andere Vorschläge
        </button>
      </div>
    </div>
  )
}
