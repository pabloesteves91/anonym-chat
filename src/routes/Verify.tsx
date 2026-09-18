import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Note, PageTitle, Panel } from '../components/ui'
import { ShieldMark } from '../components/VerifiedBadge'
import { useSession } from '../store/useSession'
import type { VerificationStage } from '../services/types'

const SCHRITTE: { key: VerificationStage; label: string; detail: string }[] = [
  { key: 'dokument', label: 'Dokument prüfen', detail: 'Echtheitsmerkmale, Gültigkeit, Lesbarkeit' },
  { key: 'liveness', label: 'Lebendprüfung', detail: 'Bewegt sich eine echte Person vor der Kamera?' },
  { key: 'abgleich', label: 'Abgleich', detail: 'Gesicht gegen Dokument, Alter gegen Mindestalter' },
]

const REIHENFOLGE: VerificationStage[] = ['idle', 'dokument', 'liveness', 'abgleich', 'fertig']

function StageRow({ stage, current }: { stage: (typeof SCHRITTE)[number]; current: VerificationStage }) {
  const currentIndex = REIHENFOLGE.indexOf(current)
  const ownIndex = REIHENFOLGE.indexOf(stage.key)
  const state = currentIndex > ownIndex ? 'fertig' : currentIndex === ownIndex ? 'laeuft' : 'offen'

  return (
    <li className="flex items-start gap-3 bg-surface p-4">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
          state === 'fertig'
            ? 'border-accent bg-accent text-accent-ink'
            : state === 'laeuft'
              ? 'border-accent text-accent'
              : 'border-line-strong text-muted'
        }`}
      >
        {state === 'fertig' ? '✓' : state === 'laeuft' ? <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent" /> : ''}
      </span>
      <span className="flex flex-col">
        <span className={`font-medium ${state === 'offen' ? 'text-muted' : 'text-ink'}`}>{stage.label}</span>
        <span className="text-sm text-muted">{stage.detail}</span>
      </span>
      <span className="label-caps ml-auto shrink-0 pt-1">
        {state === 'fertig' ? 'geprüft' : state === 'laeuft' ? 'läuft' : 'offen'}
      </span>
    </li>
  )
}

export function Verify() {
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const stage = useSession((s) => s.stage)
  const busy = useSession((s) => s.busy)
  const error = useSession((s) => s.error)
  const verify = useSession((s) => s.verify)

  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (user?.verified) {
    return (
      <div className="prose-column">
        <PageTitle kicker="Abgeschlossen">Du bist verifiziert</PageTitle>
        <Panel className="p-5">
          <p className="flex items-center gap-2 text-ink">
            <ShieldMark className="h-5 w-5 text-accent" />
            Geprüft am{' '}
            {user.verifiedAt
              ? new Date(user.verifiedAt).toLocaleString('de-CH', { dateStyle: 'long', timeStyle: 'short' })
              : 'unbekannt'}
          </p>
          <p className="mt-3 text-sm text-muted">
            Dein Anzeigename gegenüber anderen ist{' '}
            <span className="font-mono text-ink">{user.pseudonym}</span>. Mehr sieht das Gegenüber nicht.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate('/chat')}>
              Chat starten
            </Button>
            <Link to="/profil" className="rounded-sm px-3 py-2.5 text-muted transition-colors hover:text-ink">
              Profil anpassen
            </Link>
          </div>
        </Panel>
      </div>
    )
  }

  const laeuft = busy || (stage !== 'idle' && stage !== 'fertig')

  return (
    <div className="flex flex-col gap-6">
      <div className="prose-column">
        <PageTitle kicker="Einmalig, vor dem ersten Chat">Verifizierung</PageTitle>
        <p className="text-muted">
          Zwei Schritte: ein amtliches Dokument und eine kurze Lebendprüfung. Danach bist du gegenüber anderen wieder
          anonym – sichtbar bleibt nur, dass die Prüfung stattgefunden hat.
        </p>
      </div>

      <Panel className="p-5">
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            const file = inputRef.current?.files?.[0] ?? null
            const ok = await verify(file)
            if (ok) navigate('/profil')
          }}
          className="flex flex-col gap-5"
        >
          <fieldset disabled={laeuft} className="flex flex-col gap-3 border-0 p-0">
            <legend className="label-caps mb-2">Ausweisdokument</legend>
            <label
              htmlFor="dokument"
              className="flex cursor-pointer flex-col items-start gap-1 rounded-sm border border-dashed border-line-strong bg-raised px-4 py-6 transition-colors hover:border-accent"
            >
              <span className="font-medium">{fileName ?? 'Datei auswählen'}</span>
              <span className="text-sm text-muted">
                Pass, ID oder Führerausweis. Die Datei bleibt auf diesem Gerät – sie wird weder gelesen noch gespeichert
                noch gesendet. Angezeigt wird nur der Dateiname.
              </span>
              <input
                ref={inputRef}
                id="dokument"
                name="dokument"
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
              />
            </label>
          </fieldset>

          <ol className="grid gap-px overflow-hidden rounded-sm border border-line bg-line">
            {SCHRITTE.map((schritt) => (
              <StageRow key={schritt.key} stage={schritt} current={stage} />
            ))}
          </ol>

          <p aria-live="polite" className="text-sm text-muted">
            {stage === 'idle' && !error ? 'Bereit.' : null}
            {stage === 'dokument' ? 'Dokument wird geprüft …' : null}
            {stage === 'liveness' ? 'Lebendprüfung läuft. Bitte Kopf langsam bewegen.' : null}
            {stage === 'abgleich' ? 'Abgleich läuft …' : null}
            {stage === 'fertig' ? 'Verifizierung abgeschlossen.' : null}
          </p>

          {error ? <Note tone="warn">{error}</Note> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={laeuft}>
              {laeuft ? 'Prüfung läuft …' : 'Prüfung starten'}
            </Button>
            <Link to="/" className="rounded-sm px-3 py-2.5 text-sm text-muted transition-colors hover:text-ink">
              Abbrechen
            </Link>
          </div>
        </form>
      </Panel>

      <Note>
        In Phase 2 übernimmt diesen Schritt ein spezialisierter Anbieter (z.B. Veriff oder Sumsub). Ausweisdaten gehen
        dann direkt dorthin und nie über unseren Server – zurück kommt nur „geprüft, ja/nein" plus Altersnachweis.
      </Note>
    </div>
  )
}
