import { useEffect, useState } from 'react'
import { Button, Note, Panel } from './ui'
import { themaLabel } from '../services/support'
import * as api from '../services/api'
import { planById } from '../services/plans'
import type { SupportAnfrage, SupportStatus } from '../services/types'
import { useModeration } from '../store/useModeration'
import { SupportChat } from './SupportChat'

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

/**
 * Die Anhänge einer Anfrage.
 *
 * Geladen wird pro Karte und erst beim Anzeigen, nicht im `load()` der
 * Moderationsansicht. Der Grund steht in der Projektgeschichte: Ein Abruf des
 * Dateispeichers im gemeinsamen Ladevorgang hat die ganze Ansicht für zwei
 * Minuten lahmgelegt, als der Speicher nicht erreichbar war. Hier scheitert
 * im schlimmsten Fall eine Kachel, nicht die Seite.
 */
function Anhaenge({ pfade }: { pfade: string[] }) {
  const [adressen, setAdressen] = useState<string[] | null>(null)

  // Die Liste selbst taugt nicht als Abhängigkeit: Sie entsteht bei jedem
  // Rendern neu, der Effekt liefe endlos. Verglichen wird deshalb ihr Inhalt.
  const schluessel = pfade.join('|')

  useEffect(() => {
    if (!schluessel) return
    let lebt = true
    void api
      .getSupportAnhaenge(schluessel.split('|'))
      .then((gefunden) => lebt && setAdressen(gefunden))
      .catch(() => lebt && setAdressen([]))
    return () => {
      lebt = false
    }
  }, [schluessel])

  if (pfade.length === 0) return null

  if (adressen === null) {
    return (
      <p className="label-caps mt-3" role="status">
        Anhänge werden geladen …
      </p>
    )
  }

  if (adressen.length === 0) {
    return <p className="mt-3 text-sm text-muted">Die Anhänge wurden mit dem Abhaken gelöscht.</p>
  }

  return (
    <div className="mt-3">
      <p className="label-caps mb-2">
        {adressen.length} {adressen.length === 1 ? 'Anhang' : 'Anhänge'}
      </p>
      <ul className="flex flex-wrap gap-3">
        {adressen.map((adresse, nummer) => (
          <li key={adresse}>
            {/* Neuer Tab statt Vergrösserung in der Seite: Die Bilder sind
                Bildschirmfotos, die man in voller Grösse lesen will. */}
            <a href={adresse} target="_blank" rel="noopener noreferrer" title="In voller Grösse öffnen">
              <img
                src={adresse}
                alt={`Anhang ${nummer + 1}`}
                className="h-32 w-40 rounded-sm border border-line bg-raised object-contain transition-colors hover:border-accent"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Endgültiges Löschen in zwei Schritten.
 *
 * Der erste Klick fragt nur nach, erst der zweite löscht. Direkt an Ort und
 * Stelle statt in einem Dialogfenster: Die Rückfrage steht dort, wo man
 * gerade hinschaut, und "Abbrechen" ist so nah wie "Ja".
 */
function LoeschKnopf({
  label,
  frage,
  disabled,
  onLoeschen,
}: {
  label: string
  frage: string
  disabled: boolean
  onLoeschen: () => void
}) {
  const [fragt, setFragt] = useState(false)

  if (!fragt) {
    return (
      <Button size="sm" variant="danger" disabled={disabled} onClick={() => setFragt(true)}>
        {label}
      </Button>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-2" role="group" aria-label={frage}>
      <span className="text-sm font-medium text-signal">{frage}</span>
      <Button
        size="sm"
        variant="danger"
        disabled={disabled}
        onClick={() => {
          setFragt(false)
          onLoeschen()
        }}
      >
        Ja, löschen
      </Button>
      <Button size="sm" variant="quiet" onClick={() => setFragt(false)}>
        Abbrechen
      </Button>
    </span>
  )
}

function Anfragekarte({ anfrage }: { anfrage: SupportAnfrage }) {
  const busy = useModeration((s) => s.busy)
  const setSupportStatus = useModeration((s) => s.setSupportStatus)
  const loescheSupport = useModeration((s) => s.loescheSupport)
  const oeffneSupportChat = useModeration((s) => s.oeffneSupportChat)

  // Aufgeklappt, wer eine ungelesene Antwort hat – die will man sehen, ohne
  // erst zu suchen. Sonst zu, damit die Liste überschaubar bleibt.
  const neueAntwort = anfrage.ungelesenModeration === true
  const [chatSichtbar, setChatSichtbar] = useState(neueAntwort)

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
        <span className="flex flex-col items-end gap-1.5">
          <span
            className={`rounded-sm border px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide uppercase ${STATUS_STYLE[anfrage.status]}`}
          >
            {STATUS_LABEL[anfrage.status]}
          </span>
          {neueAntwort ? (
            <span className="rounded-sm bg-signal px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-surface uppercase">
              Neue Antwort
            </span>
          ) : null}
        </span>
      </div>

      <p className="mt-3 border-l-2 border-line pl-3 text-sm whitespace-pre-wrap">{anfrage.text}</p>

      <Anhaenge pfade={anfrage.anhaenge ?? []} />

      {anfrage.chatOffen && chatSichtbar ? (
        <div className="mt-4">
          <p className="label-caps mb-2">Chat mit {anfrage.pseudonym}</p>
          <SupportChat
            anfrageId={anfrage.id}
            seite="moderation"
            gegenueber={anfrage.pseudonym}
            schreibbar={anfrage.status !== 'erledigt'}
            ungelesen={neueAntwort}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!anfrage.chatOffen && anfrage.status !== 'erledigt' ? (
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => {
              setChatSichtbar(true)
              void oeffneSupportChat(anfrage.id)
            }}
          >
            Chat eröffnen
          </Button>
        ) : null}
        {anfrage.chatOffen ? (
          <Button size="sm" onClick={() => setChatSichtbar((sichtbar) => !sichtbar)}>
            {chatSichtbar ? 'Chat zuklappen' : 'Chat anzeigen'}
          </Button>
        ) : null}
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
          title={
            (anfrage.anhaenge?.length ?? 0) > 0
              ? 'Die angehängten Bilder werden dabei gelöscht.'
              : undefined
          }
          onClick={() => void setSupportStatus(anfrage.id, 'erledigt')}
        >
          Erledigt
        </Button>
        {anfrage.status !== 'offen' ? (
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => void setSupportStatus(anfrage.id, 'offen')}>
            Zurück auf offen
          </Button>
        ) : null}
        {/* Nur Erledigtes lässt sich löschen – die Regeln lehnen alles andere
            ab, der Knopf erscheint deshalb gar nicht erst. */}
        {anfrage.status === 'erledigt' ? (
          <LoeschKnopf
            label="Löschen"
            frage="Endgültig löschen?"
            disabled={busy}
            onLoeschen={() => void loescheSupport([anfrage.id])}
          />
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
  const busy = useModeration((s) => s.busy)
  const loescheSupport = useModeration((s) => s.loescheSupport)
  const erledigte = anfragen.filter((a) => a.status === 'erledigt')

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[16rem] flex-1">
          <h2 className="font-display text-2xl font-semibold">Supportanfragen</h2>
          <p className="mt-1 text-sm text-muted">
            Was Nutzende über die Supportseite schicken. Die Kennung daneben passt in die Felder der Werkzeuge weiter
            unten.
          </p>
        </div>
        {erledigte.length > 0 ? (
          <LoeschKnopf
            label={`Erledigte löschen (${erledigte.length})`}
            frage={
              erledigte.length === 1
                ? '1 erledigte Anfrage endgültig löschen?'
                : `${erledigte.length} erledigte Anfragen endgültig löschen?`
            }
            disabled={busy}
            onLoeschen={() => void loescheSupport(erledigte.map((a) => a.id))}
          />
        ) : null}
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
