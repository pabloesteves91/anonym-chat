import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button, Field, Note, PageTitle, Panel, inputClass } from '../components/ui'
import { ShieldMark } from '../components/VerifiedBadge'
import { ANMELDEARTEN } from '../services/firebase'
import { MIN_PASSWORT_LAENGE } from '../services/auth'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'
import { AppleMark, GoogleMark } from '../components/ProviderMarks'

type Modus = 'anmelden' | 'registrieren'

/** Anmeldung für Nutzende: Konto anlegen oder wiederkommen. */
export function Login() {
  const user = useAuth((s) => s.user)
  const busy = useAuth((s) => s.busy)
  const error = useAuth((s) => s.error)
  const signIn = useAuth((s) => s.signIn)
  const signInWithPassword = useAuth((s) => s.signInWithPassword)
  const register = useAuth((s) => s.register)
  const resetPassword = useAuth((s) => s.resetPassword)
  const clearError = useAuth((s) => s.clearError)
  const location = useLocation()
  const profil = useSession((s) => s.user)

  const [modus, setModus] = useState<Modus>('anmelden')
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [hinweis, setHinweis] = useState<string | null>(null)

  // Wer schon verifiziert ist, soll nicht wieder im Antrag landen.
  const standard = profil?.verified ? '/chat' : '/verifizierung'
  const ziel = (location.state as { from?: string } | null)?.from ?? standard
  if (user) return <Navigate to={ziel} replace />

  const wechsle = (neu: Modus) => {
    setModus(neu)
    setHinweis(null)
    clearError()
  }

  const absenden = async () => {
    setHinweis(null)
    if (modus === 'registrieren') await register(email, passwort)
    else await signInWithPassword(email, passwort)
  }

  const passwortVergessen = async () => {
    if (!email.trim()) {
      setHinweis('Bitte zuerst die E-Mail-Adresse eintragen.')
      return
    }
    const ok = await resetPassword(email)
    if (ok) setHinweis('Wenn es zu dieser Adresse ein Konto gibt, ist die E-Mail unterwegs.')
  }

  const registrieren = modus === 'registrieren'
  const bereit = email.includes('@') && passwort.length >= (registrieren ? MIN_PASSWORT_LAENGE : 1)

  return (
    <div className="prose-column">
      <PageTitle kicker="Konto">{registrieren ? 'Konto anlegen' : 'Anmelden'}</PageTitle>
      <p className="text-muted">
        Dein Konto bleibt hinter den Kulissen – es verbindet dich mit deiner Verifizierung, damit eine Sperre hält. Im
        Chat sehen andere davon nichts, weder deinen Namen noch deine Adresse.
      </p>

      <Panel className="mt-6 flex flex-col gap-5 p-5">
        <div className="flex gap-1 rounded-sm border border-line bg-raised p-1" role="tablist">
          {(['anmelden', 'registrieren'] as const).map((wert) => (
            <button
              key={wert}
              type="button"
              role="tab"
              aria-selected={modus === wert}
              onClick={() => wechsle(wert)}
              className={`flex-1 rounded-[2px] px-3 py-2 text-sm transition-colors ${
                modus === wert ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {wert === 'anmelden' ? 'Ich habe ein Konto' : 'Neu hier'}
            </button>
          ))}
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void absenden()
          }}
        >
          <Field label="E-Mail-Adresse" htmlFor="email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field
            label="Passwort"
            htmlFor="passwort"
            hint={registrieren ? `Mindestens ${MIN_PASSWORT_LAENGE} Zeichen.` : undefined}
          >
            <input
              id="passwort"
              type="password"
              autoComplete={registrieren ? 'new-password' : 'current-password'}
              required
              className={inputClass}
              value={passwort}
              onChange={(event) => setPasswort(event.target.value)}
            />
          </Field>

          {error ? <Note tone="warn">{error}</Note> : null}
          {hinweis ? <Note>{hinweis}</Note> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={busy || !bereit}>
              {registrieren ? 'Konto anlegen' : 'Anmelden'}
            </Button>
            {registrieren ? null : (
              <Button type="button" variant="quiet" disabled={busy} onClick={() => void passwortVergessen()}>
                Passwort vergessen
              </Button>
            )}
          </div>
        </form>

        {ANMELDEARTEN.google || ANMELDEARTEN.apple ? (
          <>
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              <span className="label-caps">oder</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <div className="flex flex-col gap-3">
              {ANMELDEARTEN.google ? (
                <Button disabled={busy} onClick={() => void signIn('google')}>
                  <GoogleMark />
                  Mit Google fortfahren
                </Button>
              ) : null}
              {ANMELDEARTEN.apple ? (
                <Button disabled={busy} onClick={() => void signIn('apple')}>
                  <AppleMark />
                  Mit Apple fortfahren
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        <p className="text-sm text-muted">
          Mit der Anmeldung stimmst du den <Link to="/agb" className="underline underline-offset-2">Nutzungsbedingungen</Link>{' '}
          zu und nimmst die <Link to="/datenschutz" className="underline underline-offset-2">Datenschutzerklärung</Link>{' '}
          zur Kenntnis. Chatverläufe werden 72 Stunden zur Missbrauchsprüfung aufbewahrt.
        </p>
      </Panel>

      <div className="mt-6 flex items-start gap-3 text-sm text-muted">
        <ShieldMark className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p>
          Nach der Anmeldung folgt die einmalige Verifizierung: Mobilnummer per SMS, Ausweisfoto und Selfie. Geprüft
          wird von Hand, üblicherweise innerhalb weniger Stunden.
        </p>
      </div>
    </div>
  )
}
