import { useState } from 'react'
import { Button, Field, Note, Panel, inputClass } from './ui'
import { GESCHLECHTER, type Geschlecht } from '../services/types'
import { useModeration } from '../store/useModeration'

/**
 * Der Supportfall zur Geschlechtsangabe.
 *
 * Nutzende geben sie einmal an und kommen danach nicht mehr heran – der
 * Anzeigename hängt daran. Wer sich vertippt hat oder es anders braucht,
 * meldet sich; korrigiert wird hier. Der Name wird dabei neu gewürfelt,
 * sonst widerspräche er der Angabe.
 */
export function GeschlechtKorrektur() {
  const setGeschlecht = useModeration((s) => s.setGeschlecht)
  const busy = useModeration((s) => s.busy)
  const [uid, setUid] = useState('')
  const [auswahl, setAuswahl] = useState<Geschlecht>('weiblich')
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const korrigieren = async () => {
    setMeldung(null)
    setFehler(null)
    const kennung = uid.trim()
    if (!kennung) {
      setFehler('Ohne Kennung geht es nicht.')
      return
    }
    const ok = await setGeschlecht(kennung, auswahl)
    if (ok) {
      setMeldung(`Geändert auf ${auswahl}. Der Anzeigename wurde neu gewürfelt.`)
      setUid('')
    } else {
      setFehler('Das hat nicht geklappt. Stimmt die Kennung?')
    }
  }

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Geschlechtsangabe korrigieren</h2>
        <p className="mt-1 text-sm text-muted">
          Die Kennung steht im Profil der Person. Mit der Änderung bekommt sie einen neuen Anzeigenamen – sag ihr das,
          bevor du es tust.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Field label="Kennung des Kontos" htmlFor="geschlecht-uid">
            <input
              id="geschlecht-uid"
              className={`${inputClass} font-mono`}
              value={uid}
              onChange={(event) => setUid(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Neue Angabe" htmlFor="geschlecht-auswahl">
          <select
            id="geschlecht-auswahl"
            className={inputClass}
            value={auswahl}
            onChange={(event) => setAuswahl(event.target.value as Geschlecht)}
          >
            {GESCHLECHTER.map((eintrag) => (
              <option key={eintrag.value} value={eintrag.value}>
                {eintrag.label}
              </option>
            ))}
          </select>
        </Field>
        <Button disabled={busy} onClick={() => void korrigieren()}>
          Ändern
        </Button>
      </div>

      {fehler ? <Note tone="warn">{fehler}</Note> : null}
      <p aria-live="polite" className="text-sm text-muted">
        {meldung ?? ''}
      </p>
    </Panel>
  )
}
