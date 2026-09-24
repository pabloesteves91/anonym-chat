import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Note, PageTitle, Panel, inputClass } from '../components/ui'
import { ShieldMark } from '../components/VerifiedBadge'
import { Kontokennung } from '../components/Kontokennung'
import { RECAPTCHA_CONTAINER_ID, maskPhone } from '../services/api'
import { VERIFY_STEPS } from '../services/types'
import type { VerifyStep } from '../services/types'
import { useSession } from '../store/useSession'
import { useVerification } from '../store/useVerification'

const datum = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('de-CH', { dateStyle: 'long', timeStyle: 'short' }) : 'unbekannt'

function StepNav({ current }: { current: VerifyStep }) {
  const index = VERIFY_STEPS.findIndex((s) => s.key === current)
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1">
      {VERIFY_STEPS.map((step, i) => (
        <li
          key={step.key}
          aria-current={i === index ? 'step' : undefined}
          className={`font-mono text-[0.6875rem] tracking-wide uppercase ${
            i === index ? 'text-accent-strong' : i < index ? 'text-ink' : 'text-muted'
          }`}
        >
          {String(i + 1).padStart(2, '0')} {step.label}
          {i < index ? ' ✓' : ''}
        </li>
      ))}
    </ol>
  )
}

function BildFeld({
  id,
  label,
  hint,
  preview,
  onPick,
  busy,
}: {
  id: string
  label: string
  hint: string
  preview: { dataUrl: string; meta: { name: string; size: number } } | null
  onPick: (file: File | null) => void
  busy: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-start gap-1 rounded-sm border border-dashed border-line-strong bg-raised px-4 py-6 transition-colors hover:border-accent"
      >
        <span className="font-medium">{preview ? 'Anderes Foto wählen' : label}</span>
        <span className="text-sm text-muted">{hint}</span>
        <input
          ref={ref}
          id={id}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        />
      </label>

      {preview ? (
        <figure className="flex items-center gap-4 rounded-sm border border-line bg-surface p-3">
          <img
            src={preview.dataUrl}
            alt={`Vorschau: ${label}`}
            className="h-24 w-24 rounded-sm border border-line object-cover"
          />
          <figcaption className="text-sm text-muted">
            <span className="block text-ink">Bereit zum Einreichen</span>
            Original {Math.round(preview.meta.size / 1024)} KB, wird verkleinert hochgeladen.
          </figcaption>
        </figure>
      ) : null}
    </div>
  )
}

/** Formular für einen neuen Antrag. */
function Antragsformular() {
  const v = useVerification()
  const navigate = useNavigate()
  const [bestaetigt, setBestaetigt] = useState(false)

  return (
    <Panel className="flex flex-col gap-6 p-5">
      <StepNav current={v.step} />

      {v.step === 'telefon' ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void v.sendCode()
          }}
        >
          <Field
            label="Mobilnummer"
            htmlFor="telefon"
            hint="Pro Nummer gibt es ein Konto. Andere sehen deine Nummer nie."
          >
            <input
              id="telefon"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="079 123 45 67"
              className={`${inputClass} sm:max-w-xs`}
              value={v.phoneInput}
              onChange={(event) => v.setPhoneInput(event.target.value)}
            />
          </Field>
          <p className="text-sm text-muted">
            Du bekommst eine SMS mit einem Code. Danach ist die Nummer fest mit deinem Konto verbunden und lässt sich
            kein zweites Mal verwenden. So kann niemand eine Sperre einfach mit einem neuen Konto umgehen.
          </p>
          {v.error ? <Note tone="warn">{v.error}</Note> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={v.busy || v.phoneInput.trim().length < 6}>
              {v.busy ? 'SMS wird gesendet …' : 'Code per SMS senden'}
            </Button>
            <Link to="/" className="rounded-sm px-3 py-2.5 text-sm text-muted transition-colors hover:text-ink">
              Abbrechen
            </Link>
          </div>
        </form>
      ) : null}

      {v.step === 'code' ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void v.confirmCode()
          }}
        >
          <Note>
            Wir haben eine SMS an <span className="font-mono text-ink">{v.phone ? maskPhone(v.phone) : 'deine Nummer'}</span>{' '}
            geschickt. Das kann einen Moment dauern.
          </Note>
          <Field label="Sechsstelliger Code" htmlFor="code" hint="Keine SMS bekommen? Dann lass dir einen neuen Code schicken.">
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className={`${inputClass} max-w-[10rem] font-mono text-lg tracking-[0.3em]`}
              value={v.codeInput}
              onChange={(event) => v.setCodeInput(event.target.value)}
            />
          </Field>
          {v.error ? <Note tone="warn">{v.error}</Note> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={v.busy || v.codeInput.length !== 6}>
              Code bestätigen
            </Button>
            <Button type="button" variant="quiet" disabled={v.busy} onClick={() => void v.sendCode()}>
              Neuen Code senden
            </Button>
            <Button type="button" variant="quiet" disabled={v.busy} onClick={() => v.goTo('telefon')}>
              Nummer ändern
            </Button>
          </div>
        </form>
      ) : null}

      {v.step === 'ausweis' ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Foto des Ausweises</h2>
            <p className="mt-1 text-sm text-muted">
              Pass, ID oder Führerausweis, gut ausgeleuchtet und vollständig im Bild. Wir prüfen Name, Geburtsdatum
              und Gültigkeit. Nichts davon erscheint in deinem Profil.
            </p>
          </div>
          <BildFeld
            id="ausweis"
            label="Ausweisfoto aufnehmen oder wählen"
            hint="JPEG oder PNG, höchstens 12 MB. Bis du einreichst, bleibt das Bild auf diesem Gerät."
            preview={v.ausweis}
            busy={v.busy}
            onPick={(file) => void v.pickImage('ausweis', file)}
          />
          {v.error ? <Note tone="warn">{v.error}</Note> : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled={!v.ausweis || v.busy} onClick={() => v.goTo('selfie')}>
              Weiter
            </Button>
            <Button variant="quiet" onClick={() => v.goTo('code')}>
              Zurück
            </Button>
          </div>
        </div>
      ) : null}

      {v.step === 'selfie' ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Selfie mit Ausweis</h2>
            <p className="mt-1 text-sm text-muted">
              Halte den Ausweis neben dein Gesicht. Beides muss scharf und lesbar sein. So sehen wir, dass Ausweis und
              Person zusammengehören.
            </p>
          </div>
          <BildFeld
            id="selfie"
            label="Selfie aufnehmen oder wählen"
            hint="Gesicht unverdeckt, keine Sonnenbrille, kein Filter."
            preview={v.selfie}
            busy={v.busy}
            onPick={(file) => void v.pickImage('selfie', file)}
          />
          {v.error ? <Note tone="warn">{v.error}</Note> : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled={!v.selfie || v.busy} onClick={() => v.goTo('pruefen')}>
              Weiter
            </Button>
            <Button variant="quiet" onClick={() => v.goTo('ausweis')}>
              Zurück
            </Button>
          </div>
        </div>
      ) : null}

      {v.step === 'pruefen' ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Zur Prüfung absenden</h2>
            <p className="mt-1 text-sm text-muted">
              Jemand aus der Moderation sieht sich die beiden Bilder an und entscheidet. Bis dahin kannst du noch nicht
              chatten.
            </p>
          </div>

          <dl className="grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
            <div className="bg-surface p-4">
              <dt className="label-caps">Mobilnummer</dt>
              <dd className="mt-1 font-mono text-sm">{v.phone ? maskPhone(v.phone) : '–'}</dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="label-caps">Ausweis</dt>
              <dd className="mt-2">
                {v.ausweis ? (
                  <img
                    src={v.ausweis.dataUrl}
                    alt="Vorschau Ausweisfoto"
                    className="h-20 w-full rounded-sm border border-line bg-raised object-contain"
                  />
                ) : (
                  '–'
                )}
              </dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="label-caps">Selfie</dt>
              <dd className="mt-2">
                {v.selfie ? (
                  <img
                    src={v.selfie.dataUrl}
                    alt="Vorschau Selfie"
                    className="h-20 w-full rounded-sm border border-line bg-raised object-contain"
                  />
                ) : (
                  '–'
                )}
              </dd>
            </div>
          </dl>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              id="bestaetigung"
              checked={bestaetigt}
              onChange={(event) => setBestaetigt(event.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              Ich bin mindestens 18 Jahre alt. Die Bilder zeigen mich und meinen eigenen Ausweis. Falsche Angaben führen
              zur dauerhaften Sperre.
            </span>
          </label>

          {v.error ? <Note tone="warn">{v.error}</Note> : null}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              disabled={v.busy || !bestaetigt}
              onClick={async () => {
                const ok = await v.submit()
                if (ok) navigate('/verifizierung')
              }}
            >
              {v.busy ? 'Wird eingereicht …' : 'Zur Prüfung einreichen'}
            </Button>
            <Button variant="quiet" onClick={() => v.goTo('selfie')}>
              Zurück
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  )
}

export function Verify() {
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const refreshUser = useSession((s) => s.refreshUser)
  const request = useVerification((s) => s.request)
  const loadRequest = useVerification((s) => s.loadRequest)
  const startOver = useVerification((s) => s.startOver)
  const busy = useVerification((s) => s.busy)

  const status = user?.verificationStatus ?? 'offen'

  useEffect(() => {
    void loadRequest()
  }, [loadRequest])

  // Während der Prüfung regelmässig nachsehen, ob entschieden wurde.
  useEffect(() => {
    if (status !== 'wartet') return
    const id = window.setInterval(() => {
      void refreshUser()
      void loadRequest()
    }, 4000)
    return () => window.clearInterval(id)
  }, [status, refreshUser, loadRequest])

  if (status === 'verifiziert' && user) {
    return (
      <div className="prose-column">
        <PageTitle kicker="Abgeschlossen">Du bist verifiziert</PageTitle>
        <Panel className="p-5">
          <p className="flex items-center gap-2 text-ink">
            <ShieldMark className="h-5 w-5 text-accent-strong" />
            Von der Moderation freigegeben am {datum(user.verifiedAt)}
          </p>
          <p className="mt-3 text-sm text-muted">
            Andere sehen dich als <span className="font-mono text-ink">{user.pseudonym}</span>.
            {user.phone ? (
              <>
                {' '}
                Hinterlegte Nummer: <span className="font-mono text-ink">{maskPhone(user.phone)}</span>.
              </>
            ) : null}{' '}
            Die eingereichten Bilder wurden nach dem Entscheid gelöscht.
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

        <div className="mt-6">
          <Kontokennung id={user.id} hinweis="Andere sehen sie nie. Du brauchst sie, wenn du dich beim Support meldest. Und sie zeigt dir, mit welchem Konto du gerade angemeldet bist." />
        </div>
      </div>
    )
  }

  if (status === 'wartet') {
    return (
      <div className="flex flex-col gap-6">
        <div className="prose-column">
          <PageTitle kicker="Eingereicht">In Prüfung</PageTitle>
          <p className="text-muted">
            Ein Mensch sieht sich Ausweis und Selfie an. Das dauert meist zwischen ein paar Minuten und einigen Stunden.
            Automatisch freigeschaltet wird niemand.
          </p>
        </div>

        <Panel className="p-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="label-caps">Eingereicht</dt>
              <dd className="mt-1 text-sm">{datum(request?.submittedAt ?? null)}</dd>
            </div>
            <div>
              <dt className="label-caps">Vorgang</dt>
              <dd className="mt-1 font-mono text-sm">{request?.id ?? '–'}</dd>
            </div>
            <div>
              <dt className="label-caps">Nummer</dt>
              <dd className="mt-1 font-mono text-sm">{request?.phoneMasked ?? '–'}</dd>
            </div>
          </dl>
          <div className="mt-5">
            <Note>
              Dein Antrag liegt bei der Moderation. Sobald entschieden ist, siehst du es hier. Die Seite aktualisiert
              sich von selbst.
            </Note>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => void refreshUser()}>Status aktualisieren</Button>
            <Button variant="danger" disabled={busy} onClick={() => void startOver()}>
              Antrag zurückziehen
            </Button>
          </div>
        </Panel>

        <Kontokennung id={user?.id ?? ''} hinweis="Andere sehen sie nie. Du brauchst sie, wenn du dich beim Support meldest. Und sie zeigt dir, mit welchem Konto du gerade angemeldet bist." />
      </div>
    )
  }

  if (status === 'abgelehnt') {
    return (
      <div className="flex flex-col gap-6">
        <div className="prose-column">
          <PageTitle kicker="Entschieden">Antrag abgelehnt</PageTitle>
          <p className="text-muted">
            Wir konnten deine Angaben nicht bestätigen. Versuch es mit besseren Fotos noch einmal.
          </p>
        </div>
        <Panel className="p-5">
          <p className="label-caps">Begründung</p>
          <p className="mt-1">{request?.rejectionReason ?? 'Ohne Angabe'}</p>
          <p className="mt-3 text-sm text-muted">Entschieden am {datum(request?.decidedAt ?? null)}.</p>
          <div className="mt-5">
            <Button variant="primary" disabled={busy} onClick={() => void startOver()}>
              Neu einreichen
            </Button>
          </div>
        </Panel>

        <Kontokennung id={user?.id ?? ''} hinweis="Andere sehen sie nie. Du brauchst sie, wenn du dich beim Support meldest. Und sie zeigt dir, mit welchem Konto du gerade angemeldet bist." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="prose-column">
        <PageTitle kicker="Einmalig, vor dem ersten Chat">Verifizierung</PageTitle>
        <p className="text-muted">
          Du bestätigst deine Mobilnummer per SMS und lädst ein Foto deines Ausweises und ein Selfie mit dem Ausweis
          hoch. Danach prüft ein Mensch die Angaben. Im Chat bleibst du anonym. Andere sehen nur, dass du verifiziert
          bist.
        </p>
      </div>

      <Antragsformular />

      <Kontokennung
        id={user?.id ?? ''}
        hinweis="Andere sehen sie nie. Du brauchst sie, wenn du dich beim Support meldest. Und sie zeigt dir, mit welchem Konto du gerade angemeldet bist."
      />

      <Note>
        Die Fotos werden verkleinert und verschlüsselt in unseren Speicher in Frankfurt hochgeladen. Ansehen kann sie
        dort nur die Moderation. Direkt nach dem Entscheid werden sie gelöscht. In deinem Browser wird keines der
        Bilder dauerhaft gespeichert.
      </Note>

      {/* Anker der unsichtbaren Sicherheitsprüfung vor dem SMS-Versand. */}
      <div id={RECAPTCHA_CONTAINER_ID} />
    </div>
  )
}
