import { useState } from 'react'
import { Button, Field, Note, PageTitle, Panel, inputClass } from './ui'
import { useAdminAccess } from '../store/useAdminAccess'



/** Anmeldung für die Moderation. */
export function ModeratorLogin() {
  const signIn = useAdminAccess((s) => s.signIn)
  const busy = useAdminAccess((s) => s.busy)
  const error = useAdminAccess((s) => s.error)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="prose-column">
      <PageTitle kicker="Nur für die Moderation">Anmeldung</PageTitle>
      <p className="text-muted">
        Verifizierungsanträge, Chatverläufe und Meldungen sind nur mit dem Moderationskonto einsehbar.
      </p>

      <Panel className="mt-6 flex flex-col gap-5 p-5">


        <form
          className="flex flex-col gap-4"
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
