import { Navigate, useLocation } from 'react-router-dom'
import { Button, Note, PageTitle, Panel } from '../components/ui'
import { ShieldMark } from '../components/VerifiedBadge'
import { ANMELDEARTEN, EMULATOR_MODE } from '../services/firebase'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'
import { AppleMark, GoogleMark } from '../components/ProviderMarks'

/** Anmeldung für Nutzende: Konto anlegen oder wiederkommen. */
export function Login() {
  const user = useAuth((s) => s.user)
  const busy = useAuth((s) => s.busy)
  const error = useAuth((s) => s.error)
  const signIn = useAuth((s) => s.signIn)
  const signInTest = useAuth((s) => s.signInTest)
  const location = useLocation()
  const profil = useSession((s) => s.user)

  // Wer schon verifiziert ist, soll nicht wieder im Antrag landen.
  const standard = profil?.verified ? '/chat' : '/verifizierung'
  const ziel = (location.state as { from?: string } | null)?.from ?? standard
  if (user) return <Navigate to={ziel} replace />

  return (
    <div className="prose-column">
      <PageTitle kicker="Konto">Anmelden oder Konto anlegen</PageTitle>
      <p className="text-muted">
        Beides geht über denselben Knopf: Wer zum ersten Mal kommt, bekommt automatisch ein Konto, wer schon eines
        hat, landet wieder darin. Dein Konto bleibt dabei hinter den Kulissen – es verbindet dich mit deiner
        Verifizierung, damit eine Sperre hält. Im Chat sehen andere davon nichts, weder deinen Namen noch deine
        Adresse.
      </p>

      <Panel className="mt-6 flex flex-col gap-3 p-5">
        {ANMELDEARTEN.google ? (
          <Button variant="primary" disabled={busy} onClick={() => void signIn('google')}>
            <GoogleMark light />
            Mit Google fortfahren
          </Button>
        ) : null}
        {ANMELDEARTEN.apple ? (
          <Button disabled={busy} onClick={() => void signIn('apple')}>
            <AppleMark />
            Mit Apple fortfahren
          </Button>
        ) : null}

        {EMULATOR_MODE ? (
          <Button disabled={busy} onClick={() => void signInTest()}>
            Testkonto (nur Emulator)
          </Button>
        ) : null}

        {error ? <Note tone="warn">{error}</Note> : null}

        <p className="text-sm text-muted">
          Mit der Anmeldung stimmst du zu, dass wir deine Angaben zur Verifizierung prüfen und Chatverläufe 72 Stunden
          zur Missbrauchsprüfung aufbewahren.
        </p>
      </Panel>

      <div className="mt-6 flex items-start gap-3 text-sm text-muted">
        <ShieldMark className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p>
          Nach der Anmeldung folgt die einmalige Verifizierung: Mobilnummer, Ausweisfoto und Selfie. Geprüft wird von
          Hand, üblicherweise innerhalb weniger Stunden.
        </p>
      </div>
    </div>
  )
}
