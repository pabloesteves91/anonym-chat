import { useState } from 'react'
import { Button, Note, Panel, inputClass } from './ui'
import { REJECTION_REASONS } from '../services/types'
import type { VerificationImages, VerificationRequest } from '../services/types'
import { useModeration } from '../store/useModeration'

const datum = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' }) : '–'

function Bild({ src, alt, laedt }: { src: string | null; alt: string; laedt: boolean }) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="label-caps">{alt}</figcaption>
      {src ? (
        <img src={src} alt={alt} className="h-40 w-full rounded-sm border border-line bg-raised object-contain" />
      ) : (
        <p
          role={laedt ? 'status' : undefined}
          className="flex h-40 items-center justify-center rounded-sm border border-dashed border-line-strong bg-raised p-3 text-center text-sm text-muted"
        >
          {laedt
            ? 'Bild wird geladen …'
            : 'Bild nicht abrufbar. Nach einem Entscheid werden die Bilder gelöscht – vorher deutet es auf ein Problem mit dem Dateispeicher hin.'}
        </p>
      )}
    </figure>
  )
}

function OffenerAntrag({ request, images }: { request: VerificationRequest; images?: VerificationImages }) {
  const decide = useModeration((s) => s.decide)
  const busy = useModeration((s) => s.busy)
  const [ablehnen, setAblehnen] = useState(false)
  const [grund, setGrund] = useState<string>(REJECTION_REASONS[0])

  return (
    <Panel as="article" className="p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div>
          <p className="font-display text-lg font-semibold">{request.pseudonym}</p>
          <p className="text-sm text-muted">
            <span className="font-mono text-xs">{request.userId}</span> · Nummer{' '}
            <span className="font-mono">{request.phoneMasked}</span> · SMS bestätigt
          </p>
          <p className="text-sm text-muted">Eingereicht {datum(request.submittedAt)}</p>
        </div>
        <span className="ml-auto rounded-sm border border-line-strong bg-raised px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-muted uppercase">
          Wartet
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Bild src={images?.ausweis ?? null} alt="Ausweisfoto" laedt={images === undefined} />
        <Bild src={images?.selfie ?? null} alt="Selfie mit Ausweis" laedt={images === undefined} />
      </div>

      <p className="mt-3 text-sm text-muted">
        Zu prüfen: Dokument gültig und lesbar, Person auf beiden Bildern dieselbe, Alter mindestens 18. Entscheiden
        lässt sich auch, wenn ein Bild nicht lädt – dann aber besser ablehnen als durchwinken.
      </p>

      {ablehnen ? (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void decide(request.id, 'abgelehnt', grund)
            setAblehnen(false)
          }}
        >
          <label htmlFor={`grund-${request.id}`} className="label-caps">
            Begründung für die ablehnende Entscheidung
          </label>
          <select
            id={`grund-${request.id}`}
            className={`${inputClass} sm:max-w-md`}
            value={grund}
            onChange={(event) => setGrund(event.target.value)}
          >
            {REJECTION_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="danger" type="submit" disabled={busy}>
              Ablehnung absenden
            </Button>
            <Button size="sm" variant="quiet" type="button" onClick={() => setAblehnen(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void decide(request.id, 'freigegeben')}>
            Freigeben
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => setAblehnen(true)}>
            Ablehnen
          </Button>
        </div>
      )}
    </Panel>
  )
}

function EntschiedenerAntrag({ request }: { request: VerificationRequest }) {
  const freigegeben = request.status === 'freigegeben'
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-surface px-4 py-3 text-sm">
      <span className="font-mono">{request.pseudonym}</span>
      <span
        className={`rounded-sm border px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide uppercase ${
          freigegeben ? 'border-accent/45 bg-accent-soft text-accent-strong' : 'border-signal/45 bg-signal-soft text-signal'
        }`}
      >
        {freigegeben ? 'Freigegeben' : 'Abgelehnt'}
      </span>
      {request.rejectionReason ? <span className="text-muted">{request.rejectionReason}</span> : null}
      <span className="ml-auto text-muted">{datum(request.decidedAt)}</span>
    </li>
  )
}

/** Warteschlange der manuellen Verifizierung. */
export function VerificationQueue() {
  const requests = useModeration((s) => s.requests)
  const images = useModeration((s) => s.images)

  const offen = requests.filter((r) => r.status === 'wartet')
  const entschieden = requests.filter((r) => r.status !== 'wartet')

  return (
    <section className="flex flex-col gap-4" aria-labelledby="verifizierungen">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 id="verifizierungen" className="font-display text-2xl font-semibold">
          Verifizierungen
        </h2>
        <span className="label-caps">{offen.length} offen</span>
      </div>

      {offen.length === 0 ? (
        <Panel className="p-5">
          <p className="text-sm text-muted">
            Keine offenen Anträge. Jede Freigabe hier ist eine menschliche Entscheidung – das System verifiziert
            nichts von selbst.
          </p>
        </Panel>
      ) : (
        offen.map((request) => <OffenerAntrag key={request.id} request={request} images={images[request.id]} />)
      )}

      {offen.length > 0 ? (
        <Note>
          Die Bilder liegen nur im Sitzungsspeicher dieses Browsers und werden nach dem Entscheid gelöscht. In der
          echten Version läge hier eine Prüfoberfläche mit Zugriffsprotokoll, Vier-Augen-Prinzip und Aufbewahrungsfrist.
        </Note>
      ) : null}

      {entschieden.length > 0 ? (
        <div>
          <p className="label-caps mb-2">Entschieden</p>
          <ul className="flex flex-col gap-px overflow-hidden rounded-sm border border-line bg-line">
            {entschieden.map((request) => (
              <EntschiedenerAntrag key={request.id} request={request} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
