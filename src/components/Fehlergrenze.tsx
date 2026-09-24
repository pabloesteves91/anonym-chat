import { Component, type ReactNode } from 'react'
import { Button, Panel } from './ui'

/**
 * Fängt Abstürze einer Seite ab, damit nicht die ganze App weiss wird.
 *
 * Kopfzeile und Menü bleiben stehen; an der Stelle der Seite erscheint ein
 * Hinweis mit „Neu laden“. Häufigster Grund nach einem Update: Der Browser
 * hatte noch die alte Fassung offen und findet einen Teil davon nicht mehr.
 * Wechselt die Adresse, wird die Grenze zurückgesetzt (`schluessel`).
 */
export class Fehlergrenze extends Component<{ children: ReactNode; schluessel?: string }, { fehler: Error | null; fuer?: string }> {
  state: { fehler: Error | null; fuer?: string } = { fehler: null }

  static getDerivedStateFromError(fehler: Error) {
    return { fehler }
  }

  static getDerivedStateFromProps(props: { schluessel?: string }, state: { fehler: Error | null; fuer?: string }) {
    // Andere Seite aufgerufen: neuer Versuch.
    if (state.fehler && props.schluessel !== state.fuer) return { fehler: null, fuer: props.schluessel }
    return { fuer: props.schluessel }
  }

  componentDidCatch(fehler: Error) {
    console.error('[NØNE] Seite abgestürzt:', fehler)
  }

  render() {
    if (!this.state.fehler) return this.props.children
    return (
      <Panel className="p-6">
        <p className="label-caps">Fehler</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="mt-2 max-w-prose text-muted">
          Diese Seite liess sich nicht anzeigen. Meist hilft Neuladen – etwa wenn NØNE gerade aktualisiert wurde.
        </p>
        <div className="mt-5">
          <Button variant="primary" onClick={() => window.location.reload()}>
            Neu laden
          </Button>
        </div>
      </Panel>
    )
  }
}
