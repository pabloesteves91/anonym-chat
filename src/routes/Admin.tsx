import { useEffect } from 'react'
import { Button, Note, PageTitle, Panel } from '../components/ui'
import { REPORT_REASONS } from '../services/types'
import type { Report, ReportStatus } from '../services/types'
import { useModeration } from '../store/useModeration'
import { useAdminAccess } from '../store/useAdminAccess'
import { VerificationQueue } from '../components/VerificationQueue'
import { TranscriptList } from '../components/TranscriptList'
import { PlanZuteilung } from '../components/PlanZuteilung'

const STATUS_LABEL: Record<ReportStatus, string> = {
  offen: 'Offen',
  geprueft: 'Geprüft',
  gesperrt: 'Gesperrt',
}

const STATUS_STYLE: Record<ReportStatus, string> = {
  offen: 'border-line-strong bg-raised text-muted',
  geprueft: 'border-accent/45 bg-accent-soft text-accent',
  gesperrt: 'border-signal/45 bg-signal-soft text-signal',
}

function reasonLabel(report: Report) {
  return REPORT_REASONS.find((r) => r.value === report.reason)?.label ?? report.reason
}

function ReportCard({ report }: { report: Report }) {
  const setStatus = useModeration((s) => s.setStatus)
  const busy = useModeration((s) => s.busy)

  return (
    <Panel as="article" className="p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{reasonLabel(report)}</p>
          <p className="text-sm text-muted">
            Gemeldet: <span className="font-mono text-ink">{report.reportedPseudonym}</span>{' '}
            <span className="font-mono text-xs">({report.reportedId})</span>
          </p>
          <p className="text-sm text-muted">
            Melder: <span className="font-mono">{report.reporterPseudonym}</span> ·{' '}
            {new Date(report.createdAt).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>

        <div className="ml-auto flex flex-col items-end gap-2">
          <span
            className={`rounded-[2px] border px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide uppercase ${STATUS_STYLE[report.status]}`}
          >
            {STATUS_LABEL[report.status]}
          </span>
          {report.autoFlags > 0 ? (
            <span className="font-mono text-[0.6875rem] tracking-wide text-signal uppercase">
              {report.autoFlags} Filtertreffer
            </span>
          ) : null}
        </div>
      </div>

      {report.note ? <p className="mt-3 border-l-2 border-line pl-3 text-sm">{report.note}</p> : null}

      {report.excerpt.length > 0 ? (
        <details className="mt-3">
          <summary className="label-caps cursor-pointer">Auszug · {report.excerpt.length} Nachrichten</summary>
          <ol className="mt-2 flex flex-col gap-1.5">
            {report.excerpt.map((entry) => (
              <li key={`${entry.ts}-${entry.text.slice(0, 12)}`} className="text-sm">
                <span className="font-mono text-xs text-muted">
                  {entry.author === 'me' ? 'Melder' : 'Gemeldet'} ·{' '}
                  {new Date(entry.ts).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="ml-2">{entry.text}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          // Aus einer Sperre führt nur der ausdrückliche Weg "Sperre aufheben",
          // nicht ein beiläufiges "geprüft".
          disabled={busy || report.status !== 'offen'}
          onClick={() => void setStatus(report.id, 'geprueft')}
        >
          Als geprüft markieren
        </Button>
        {report.status === 'gesperrt' ? (
          <Button size="sm" disabled={busy} onClick={() => void setStatus(report.id, 'offen')}>
            Sperre aufheben
          </Button>
        ) : (
          <Button size="sm" variant="danger" disabled={busy} onClick={() => void setStatus(report.id, 'gesperrt')}>
            Konto sperren
          </Button>
        )}
      </div>
    </Panel>
  )
}

export function Admin() {
  const email = useAdminAccess((s) => s.email)
  const signOut = useAdminAccess((s) => s.signOut)
  const ready = useModeration((s) => s.ready)
  const reports = useModeration((s) => s.reports)
  const blocked = useModeration((s) => s.blocked)
  const busy = useModeration((s) => s.busy)
  const load = useModeration((s) => s.load)
  const clearAll = useModeration((s) => s.clearAll)
  const fehler = useModeration((s) => s.error)

  useEffect(() => {
    void load()
  }, [load])

  const zaehler: Record<ReportStatus, number> = {
    offen: reports.filter((r) => r.status === 'offen').length,
    geprueft: reports.filter((r) => r.status === 'geprueft').length,
    gesperrt: reports.filter((r) => r.status === 'gesperrt').length,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="prose-column">
        <PageTitle kicker="Nur für die Moderation">Moderation</PageTitle>
        <p className="text-muted">
          Verifizierungsanträge, Chatverläufe und Meldungen aller Konten. Jeder Blick in einen Verlauf wird
          protokolliert.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-surface px-4 py-3">
        <span className="label-caps">Angemeldet</span>
        <span className="font-mono text-sm">{email ?? 'unbekannt'}</span>
        <Button size="sm" className="ml-auto" onClick={() => void signOut()}>
          Abmelden
        </Button>
      </div>

      {fehler ? (
        <Panel className="flex flex-col gap-3 border-signal/45 p-5">
          <h2 className="font-display text-xl font-semibold">Das hat nicht geklappt</h2>
          <Note tone="warn">{fehler}</Note>
          <p className="text-sm text-muted">
            Bei „Dafür fehlen die Rechte" prüft Firestore die Kennung dieses Kontos gegen die in
            <span className="font-mono"> firestore.rules</span> hinterlegte. Stimmen sie nicht überein, lehnt der
            Server ab, auch wenn die Anmeldung geklappt hat.
          </p>
          <div>
            <Button disabled={busy} onClick={() => void load()}>
              Neu laden
            </Button>
          </div>
        </Panel>
      ) : null}

      <VerificationQueue />

      <TranscriptList />

      <h2 className="font-display text-2xl font-semibold">Meldungen</h2>

      <div className="grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-4">
        {(['offen', 'geprueft', 'gesperrt'] as ReportStatus[]).map((status) => (
          <div key={status} className="bg-surface p-4">
            <p className="label-caps">{STATUS_LABEL[status]}</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{zaehler[status]}</p>
          </div>
        ))}
        <div className="bg-surface p-4">
          <p className="label-caps">Gesperrte Konten</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{blocked.length}</p>
          <p className="mt-1 text-xs text-muted">Werden im Matching nicht mehr vorgeschlagen.</p>
        </div>
      </div>

      {!ready ? (
        <p className="label-caps" role="status">
          Meldungen werden geladen …
        </p>
      ) : reports.length === 0 ? (
        <Panel className="p-6">
          <h2 className="font-display text-xl font-semibold">Keine Meldungen</h2>
          <p className="mt-2 text-sm text-muted">
            Sobald im Chat gemeldet wird, erscheint der Vorgang hier – mit Grund, Freitext und dem mitgeschickten
            Auszug.
          </p>
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}

      <PlanZuteilung />

      <Panel className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl font-semibold">Alles zurücksetzen</h2>
        <Note tone="warn">
          Löscht Meldungen, Sperren, Chatverläufe und das Zugriffsprotokoll – für alle Konten, endgültig. Gedacht ist
          das für den Übergang in den Echtbetrieb, nicht für den Alltag: Mit dem Protokoll verschwindet auch der
          Nachweis darüber, wer welchen Verlauf gelesen hat, und aufgehobene Sperren lassen gesperrte Konten
          zurückkommen.
        </Note>
        <div>
          <Button variant="danger" disabled={busy} onClick={() => void clearAll()}>
            Alles löschen
          </Button>
        </div>
      </Panel>
    </div>
  )
}
