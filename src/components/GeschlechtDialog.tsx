import { useState } from 'react'
import { Dialog } from './Dialog'
import { Button, Note } from './ui'
import { GESCHLECHTER, type Geschlecht } from '../services/types'
import { useSession } from '../store/useSession'

/**
 * Die einmalige Angabe nach der Registrierung.
 *
 * Anders als die Tarifwahl lässt sich dieses Fenster nicht überspringen:
 * Ohne die Angabe gibt es keinen passenden Namen, und der Name ist im Chat
 * das Einzige, was über das Gegenüber etwas aussagt.
 *
 * Geändert wird sie danach nur noch über den Support. Das steht hier, bevor
 * jemand wählt – nicht hinterher.
 */
export function GeschlechtDialog() {
  const user = useSession((s) => s.user)
  const ready = useSession((s) => s.ready)
  const loading = useSession((s) => s.loading)
  const busy = useSession((s) => s.busy)
  const setzeGeschlecht = useSession((s) => s.setGeschlecht)

  const [auswahl, setAuswahl] = useState<Geschlecht | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const offen = ready && !loading && Boolean(user) && !user?.geschlecht

  const speichern = async () => {
    if (!auswahl) return
    setFehler(null)
    const ok = await setzeGeschlecht(auswahl)
    if (!ok) setFehler('Die Angabe wurde nicht gespeichert. Bitte erneut versuchen.')
  }

  return (
    <Dialog
      open={offen}
      // Kein Weg daran vorbei: Escape und Klick daneben tun nichts.
      onClose={() => {}}
      title="Noch eine Angabe"
      description="Sie bestimmt, wie dein Anzeigename gebildet wird."
    >
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">Geschlecht</legend>
        {GESCHLECHTER.map((eintrag) => (
          <label
            key={eintrag.value}
            className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 transition-colors ${
              auswahl === eintrag.value ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
            }`}
          >
            <input
              type="radio"
              name="geschlecht"
              value={eintrag.value}
              checked={auswahl === eintrag.value}
              onChange={() => setAuswahl(eintrag.value)}
              className="accent-[var(--accent)]"
            />
            <span className="font-medium">{eintrag.label}</span>
          </label>
        ))}
      </fieldset>

      <Note tone="warn">
        Diese Angabe lässt sich nur einmal machen. Ändern kann sie danach ausschliesslich der Support – dein
        Anzeigename hängt daran, und ein Name, der sich beliebig umstellen lässt, sagt nichts mehr aus. Ist sie
        verrutscht, schreib uns über „Support" unten auf jeder Seite.
      </Note>

      <p className="text-sm text-muted">
        Gefiltert oder sortiert wird danach nicht: Wer dir zugelost wird, entscheidet die Sprache – und mit Plus die
        Interessen.
      </p>

      {fehler ? <Note tone="warn">{fehler}</Note> : null}

      <div>
        <Button type="button" variant="primary" disabled={busy || !auswahl} onClick={() => void speichern()}>
          {busy ? 'Wird gespeichert …' : 'Angabe bestätigen'}
        </Button>
      </div>
    </Dialog>
  )
}
