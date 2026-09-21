import { useState } from 'react'
import { Button, Field, Note, Panel, inputClass } from './ui'
import { PLAENE, type PlanId } from '../services/plans'
import { useModeration } from '../store/useModeration'

/** Wie lange ein vergebener Tarif gilt. `null` heisst: ohne Ablauf. */
const LAUFZEIT: Record<PlanId, number | null> = {
  frei: null,
  'plus-monat': 30,
  'plus-jahr': 365,
  lifetime: null,
}

/**
 * Tarif von Hand vergeben.
 *
 * Ein Notbehelf, solange es keine Kasse gibt: Wer bezahlt hat, wird hier
 * eingetragen. Die Regeln lassen das ausschliesslich diesem Konto zu – ein
 * Browser darf über einen bezahlten Zugang nicht selbst entscheiden.
 */
export function PlanZuteilung() {
  const setPlan = useModeration((s) => s.setPlan)
  const busy = useModeration((s) => s.busy)
  const [uid, setUid] = useState('')
  const [plan, setPlanAuswahl] = useState<PlanId>('plus-monat')
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const vergeben = async () => {
    setMeldung(null)
    setFehler(null)
    const kennung = uid.trim()
    if (!kennung) {
      setFehler('Ohne Kennung geht es nicht.')
      return
    }
    const ok = await setPlan(kennung, plan, LAUFZEIT[plan])
    if (ok) {
      setMeldung(`Tarif gesetzt: ${plan} für ${kennung}.`)
      setUid('')
    } else {
      setFehler('Das hat nicht geklappt. Stimmt die Kennung?')
    }
  }

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Tarif vergeben</h2>
        <p className="mt-1 text-sm text-muted">
          Die Kennung steht im Profil der Person und in jeder Meldung. Monats- und Jahrestarife laufen nach 30
          beziehungsweise 365 Tagen von selbst aus; Lifetime nie.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Field label="Kennung des Kontos" htmlFor="plan-uid">
            <input
              id="plan-uid"
              className={`${inputClass} font-mono`}
              value={uid}
              onChange={(event) => setUid(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Tarif" htmlFor="plan-auswahl">
          <select
            id="plan-auswahl"
            className={inputClass}
            value={plan}
            onChange={(event) => setPlanAuswahl(event.target.value as PlanId)}
          >
            {PLAENE.map((eintrag) => (
              <option key={eintrag.id} value={eintrag.id}>
                {eintrag.name}
              </option>
            ))}
          </select>
        </Field>
        <Button variant="primary" disabled={busy} onClick={() => void vergeben()}>
          Setzen
        </Button>
      </div>

      {fehler ? <Note tone="warn">{fehler}</Note> : null}
      <p aria-live="polite" className="text-sm text-muted">
        {meldung ?? ''}
      </p>
    </Panel>
  )
}
