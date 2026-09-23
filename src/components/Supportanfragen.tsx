import { useState } from 'react'
import { Button, Note, Panel } from './ui'
import { themaLabel } from '../services/support'
import { planById } from '../services/plans'
import type { SupportAnfrage, SupportStatus } from '../services/types'
import { useModeration } from '../store/useModeration'

const STATUS_LABEL: Record<SupportStatus, string> = {
  offen: 'Offen',
  inArbeit: 'In Arbeit',
  erledigt: 'Erledigt',
}

const STATUS_STYLE: Record<SupportStatus, string> = {
  offen: 'border-signal/45 bg-signal-soft text-signal',
  inArbeit: 'border-accent/45 bg-accent-soft text-accent-strong',
  erledigt: 'border-line-strong bg-raised text-muted',
}

const VERIFIZIERUNG_LABEL: Record<string, string> = {
  offen: 'nicht verifiziert',
  wartet: 'in Prüfung',
  verifiziert: 'verifiziert',
  abgelehnt: 'abgelehnt',
}

function Kennung({ id }: { id: string }) {
  const [kopiert, setKopiert] = useState(false)
  return (
    <button
      type="button"
      // Die Werkzeuge weiter unten auf dieser Seite nehmen die Kennung als
      // Eingabe – abtippen wäre eine Fehlerquelle ohne Zweck.
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id)
          setKopiert(true)
          window.setTimeout(() => setKopiert(false), 2000)
        } catch {
          /* Ohne Zwischenablage bleibt die Kennung immerhin lesbar. */
        }
      }}
      className="rounded-sm border border-line px-2 py-0.5 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-ink"
      title="Kennung kopieren"
    >
      {kopiert ? 'kopiert' : id}
    </button>
  )
}

function Anfragekarte({ anfrage }: { anfrage: SupportAnfrage }) {
  const busy = useModeration((s) => s.busy)
  const setSupportStatus = useModeration((s) => s.setSupportStatus)

  const zeit = new Date(anfrage.createdAt).toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-[14rem] flex-1">
          <p className="label-caps">{themaLabel(anfrage.thema)}</p>
          <h3 className="mt-1 font-display text-lg font-semibold">{anfrage.betreff}</h3>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono">{anfrage.pseudonym}</span> · {zeit} ·{' '}
            {VERIFIZIERUNG_LABEL[anfrage.verifizierung] ?? anfrage.verifizierung} ·{' '}
            {planById(anfrage.plan).name}
          </p>
        </div>
        <span
          className={`rounded-sm border px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide uppercase ${STATUS_STYLE[anfrage.status]}`}
        >
          {STATUS_LABEL[anfrage.status]}
        </span>
      </div>

      <p className="mt-3 border-l-2 border-line pl-3 text-sm whitespace-pre-wrap">{anfrage.text}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy || anfrage.status === 'inArbeit'}
          onClick={() => void setSupportStatus(anfrage.id, 'inArbeit')}
        >
          Übernehmen
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy || anfrage.status === 'erledigt'}
          onClick={() => void setSupportStatus(anfrage.id, 'erledigt')}
        >
          Erledigt
        </Button>
        {anfrage.status !== 'offen' ? (
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => void setSupportStatus(anfrage.id, 'offen')}>
            Zurück auf offen
          </Button>
        ) : null}

        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          <a href={`mailto:${anfrage.antwortAn}`} className="underline underline-offset-2 hover:text-ink">
            {anfrage.antwortAn}
          </a>
          <Kennung id={anfrage.userId} />
        </span>
      </div>
    </Panel>
  )
}

/**
 * Die eingegangenen Supportanfragen.
 *
 * Steht über den Werkzeugen, die sie erledigen – Geschlechtskorrektur und
 * Tarifvergabe –, weil das die übliche Reihenfolge ist: erst lesen, was
 * jemand will, dann das Werkzeug greifen.
 *
 * Sichtbar für Moderation und Verwaltung gleichermassen: Supportanfragen sind
 * Tagesgeschäft, kein Verwaltungsrecht.
 */
export function Supportanfragen() {
  const anfragen = useModeration((s) => s.support)

  const zaehler: Record<SupportStatus, number> = {
    offen: anfragen.filter((a) => a.status === 'offen').length,
    inArbeit: anfragen.filter((a) => a.status === 'inArbeit').length,
    erledigt: anfragen.filter((a) => a.status === 'erledigt').length,
  }

  // Erledigtes nach unten: Was noch zu tun ist, gehört nach oben.
  const sortiert = [...anfragen].sort((a, b) => {
    const rang = (s: SupportStatus) => (s === 'offen' ? 0 : s === 'inArbeit' ? 1 : 2)
    return rang(a.status) - rang(b.status)
  })

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">Supportanfragen</h2>
        <p className="mt-1 text-sm text-muted">
          Was Nutzende über die Supportseite schicken. Die Kennung daneben passt in die Felder der Werkzeuge weiter
          unten.
        </p>
      </div>

      <div className="grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
        {(['offen', 'inArbeit', 'erledigt'] as SupportStatus[]).map((status) => (
          <div key={status} className="bg-surface p-4">
            <p className="label-caps">{STATUS_LABEL[status]}</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{zaehler[status]}</p>
          </div>
        ))}
      </div>

      {anfragen.length === 0 ? (
        <Note>
          Keine Anfragen. Wer über „Support" schreibt, erscheint hier – mit Thema, Stand des Kontos und der Adresse für
          die Antwort.
        </Note>
      ) : (
        <div className="flex flex-col gap-4">
          {sortiert.map((anfrage) => (
            <Anfragekarte key={anfrage.id} anfrage={anfrage} />
          ))}
        </div>
      )}
    </section>
  )
}
