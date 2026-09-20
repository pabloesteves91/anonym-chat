import { useEffect, useState } from 'react'
import { Button, Note, Panel } from './ui'
import type { ChatTranscript } from '../services/types'
import { useModeration } from '../store/useModeration'

const zeit = (iso: string) =>
  new Date(iso).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })

const uhrzeit = (ts: number) =>
  new Date(ts).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })

/** Restlaufzeit bis zur automatischen Löschung, gemessen am übergebenen Jetzt. */
function restzeit(expiresAt: number, now: number): string {
  const ms = expiresAt - now
  if (ms <= 0) return 'läuft ab'
  const stunden = Math.floor(ms / 3_600_000)
  if (stunden >= 1) return `noch ${stunden} h`
  return `noch ${Math.max(1, Math.round(ms / 60_000))} min`
}

function Verlauf({ transcript, now }: { transcript: ChatTranscript; now: number }) {
  const openTranscript = useModeration((s) => s.openTranscript)
  const deleteTranscript = useModeration((s) => s.deleteTranscript)
  const opened = useModeration((s) => s.opened[transcript.id])
  const busy = useModeration((s) => s.busy)

  return (
    <Panel as="article" className="p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-mono text-sm text-ink">
            {transcript.ownerPseudonym} <span className="text-muted">↔</span> {transcript.partnerPseudonym}
          </p>
          <p className="text-sm text-muted">
            Beendet {zeit(transcript.endedAt)} · {transcript.messages.length} Nachrichten
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {transcript.reported ? (
            <span className="rounded-[2px] border border-signal/45 bg-signal-soft px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-signal uppercase">
              Gemeldet
            </span>
          ) : null}
          {transcript.flagCount > 0 ? (
            <span className="font-mono text-[0.6875rem] tracking-wide text-signal uppercase">
              {transcript.flagCount} Filtertreffer
            </span>
          ) : null}
          <span className="rounded-[2px] border border-line-strong bg-raised px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-muted uppercase">
            {restzeit(transcript.expiresAt, now)}
          </span>
        </div>
      </div>

      {opened ? (
        <ol className="mt-3 flex flex-col gap-1.5 border-l-2 border-line pl-3">
          {opened.messages.map((message, index) => (
            <li key={`${message.ts}-${index}`} className="text-sm">
              <span className="font-mono text-xs text-muted">
                {message.author === 'me' ? opened.ownerPseudonym : opened.partnerPseudonym} · {uhrzeit(message.ts)}
              </span>
              <span className="ml-2">{message.text}</span>
              {message.flag ? (
                <span className="ml-2 font-mono text-[0.6875rem] tracking-wide text-signal uppercase">
                  ▲ {message.flag.reason}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {opened ? null : (
          <Button size="sm" disabled={busy} onClick={() => void openTranscript(transcript.id)}>
            Verlauf öffnen
          </Button>
        )}
        <Button size="sm" variant="danger" disabled={busy} onClick={() => void deleteTranscript(transcript.id)}>
          Jetzt löschen
        </Button>
      </div>
    </Panel>
  )
}

/** Moderationsspeicher: Verläufe mit Frist und Zugriffsprotokoll. */
export function TranscriptList() {
  const alle = useModeration((s) => s.transcripts)
  const accessLog = useModeration((s) => s.accessLog)

  // Die Frist läuft auch ohne Neuladen weiter: die Uhr liegt im Zustand,
  // damit die Restzeit stimmt und Abgelaufenes von selbst verschwindet.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const transcripts = alle.filter((t) => t.expiresAt > now)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="verlaeufe">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 id="verlaeufe" className="font-display text-2xl font-semibold">
          Chatverläufe
        </h2>
        <span className="label-caps">{transcripts.length} gespeichert · 72 Stunden</span>
      </div>

      <Note tone="warn">
        Hier liegen private Gespräche von Menschen, die sich unbeobachtet glauben. Jedes Öffnen wird unten
        protokolliert. Öffnen nur mit Anlass – Spamverdacht, Meldung, Filtertreffer –, nie aus Neugier.
      </Note>

      {transcripts.length === 0 ? (
        <Panel className="p-5">
          <p className="text-sm text-muted">
            Keine gespeicherten Verläufe. Nach jedem beendeten Chat erscheint hier einer und verschwindet 72 Stunden
            später von selbst.
          </p>
        </Panel>
      ) : (
        transcripts.map((transcript) => <Verlauf key={transcript.id} transcript={transcript} now={now} />)
      )}

      {accessLog.length > 0 ? (
        <div>
          <p className="label-caps mb-2">Zugriffsprotokoll</p>
          <ul className="flex flex-col gap-px overflow-hidden rounded-sm border border-line bg-line">
            {accessLog.slice(0, 8).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 bg-surface px-4 py-2 text-sm">
                <span>{entry.action === 'geoeffnet' ? 'Verlauf geöffnet' : 'Verlauf gelöscht'}</span>
                <span className="font-mono text-xs text-muted">{entry.transcriptId}</span>
                <span className="text-muted">{entry.by}</span>
                <span className="ml-auto text-muted">{zeit(entry.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
