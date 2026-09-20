import { useState } from 'react'
import { Button, Field, Note, PageTitle, Panel, inputClass } from './ui'
import { useAdminAccess } from '../store/useAdminAccess'
import { ANMELDEARTEN } from '../services/firebase'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 01-2.3 3.5v2.9h3.7C21.8 19 23 15.9 23 12.3z" />
      <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 20.9 7.6 23.5 12 23.5z" />
      <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 010-4.4v-3H1.8a11.5 11.5 0 000 10.4l3.8-3z" />
      <path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.6 15.1.5 12 .5 7.6.5 3.7 3.1 1.8 6.8l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z" />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <path d="M16.4 12.8c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7c1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.3-.9-2.3-3.6zM14.2 5.3c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.6-.9 2.6 1 .1 2-.5 2.6-1.2z" />
    </svg>
  )
}

/** Anmeldung für die Moderation. */
export function ModeratorLogin() {
  const signIn = useAdminAccess((s) => s.signIn)
  const signInWith = useAdminAccess((s) => s.signInWith)
  const busy = useAdminAccess((s) => s.busy)
  const error = useAdminAccess((s) => s.error)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="prose-column">
      <PageTitle kicker="Nur für die Moderation">Anmeldung</PageTitle>
      <p className="text-muted">
        Verifizierungsanträge, Chatverläufe und Meldungen sind nur mit einem berechtigten Konto einsehbar.
      </p>

      <Panel className="mt-6 flex flex-col gap-5 p-5">
        {ANMELDEARTEN.google || ANMELDEARTEN.apple ? (
          <div className="flex flex-col gap-2">
            {ANMELDEARTEN.google ? (
              <Button disabled={busy} onClick={() => void signInWith('google')}>
                <GoogleMark />
                Mit Google anmelden
              </Button>
            ) : null}
            {ANMELDEARTEN.apple ? (
              <Button disabled={busy} onClick={() => void signInWith('apple')}>
                <AppleMark />
                Mit Apple anmelden
              </Button>
            ) : null}
          </div>
        ) : null}

        {ANMELDEARTEN.passwort && (ANMELDEARTEN.google || ANMELDEARTEN.apple) ? (
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="label-caps">oder</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ) : null}

        <form
          className="flex flex-col gap-4"
          hidden={!ANMELDEARTEN.passwort}
          onSubmit={(event) => {
            event.preventDefault()
            void signIn(email, password)
          }}
        >
          <Field label="E-Mail" htmlFor="mod-email">
            <input
              id="mod-email"
              type="email"
              autoComplete="username"
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Passwort" htmlFor="mod-password">
            <input
              id="mod-password"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {error ? <Note tone="warn">{error}</Note> : null}

          <div>
            <Button type="submit" variant="primary" disabled={busy || !email || !password}>
              {busy ? 'Wird geprüft …' : 'Anmelden'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
