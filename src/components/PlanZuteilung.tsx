import { useState } from 'react'
import { Button, Field, Note, Panel, inputClass } from './ui'
import { PLAENE, planById, type PlanId } from '../services/plans'
import { useModeration } from '../store/useModeration'
import type { PlanRequest } from '../services/types'

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
  const wuensche = useModeration((s) => s.planRequests)
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

      <Wunschliste
        wuensche={wuensche}
        busy={busy}
        onUebernehmen={(userId, gewuenscht) => {
          setUid(userId)
          setPlanAuswahl(gewuenscht)
          setMeldung(null)
          setFehler(null)
        }}
      />

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

/**
 * Offene Tarifwünsche.
 *
 * Ein Wunsch ist kein Zahlungseingang. Die Liste sagt nur, wer sich was
 * ausgesucht hat – ob bezahlt wurde, steht auf dem Konto, nicht hier.
 */
function Wunschliste({
  wuensche,
  busy,
  onUebernehmen,
}: {
  wuensche: PlanRequest[]
  busy: boolean
  onUebernehmen: (userId: string, plan: PlanId) => void
}) {
  const offen = wuensche.filter((wunsch) => !wunsch.erledigt)

  if (offen.length === 0) {
    return (
      <p className="text-sm text-muted">
        Keine offenen Wünsche. Wer auf der Tarifseite einen bezahlten Zugang wählt, erscheint hier.
      </p>
    )
  }

  return (
    <div>
      <p className="label-caps mb-2">{offen.length} offen</p>
      <ul className="flex flex-col gap-px overflow-hidden rounded-sm border border-line bg-line">
        {offen.map((wunsch) => (
          <li key={wunsch.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-3 py-2 text-sm">
            <span className="font-mono">{wunsch.pseudonym}</span>
            <span className="text-accent">{planById(wunsch.plan as PlanId).name}</span>
            <span className="text-muted">
              {new Date(wunsch.at).toLocaleDateString('de-CH', { dateStyle: 'short' })}
            </span>
            <span className="font-mono text-xs text-muted">{wunsch.userId}</span>
            <span className="ml-auto">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onUebernehmen(wunsch.userId, wunsch.plan as PlanId)}
              >
                Übernehmen
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">
        „Übernehmen" füllt das Formular unten aus – freigeschaltet wird erst mit „Setzen", und erst, wenn das Geld da
        ist.
      </p>
    </div>
  )
}
