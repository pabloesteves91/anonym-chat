import { useState } from 'react'
import { Button, Field, Note, PageTitle, Panel, inputClass } from './ui'
import { AppleMark, GoogleMark } from './ProviderMarks'
import { ANMELDEARTEN, MODERATOR_UID } from '../services/firebase'
import { useAdminAccess } from '../store/useAdminAccess'

/**
 * Anmeldung für die Moderation.
 *
 * Alle drei Wege, die Firebase kennt – wer das Moderationskonto über Apple
 * angelegt hat, hat kein Passwort, und ein reines Passwortformular sperrt
 * ihn dann aus seiner eigenen Ansicht aus.
 *
 * Entschieden wird hier nichts: Ob ein Konto hineindarf, sagt
 * `evaluateAccess`, und ob es die Daten sehen darf, sagen die Security
 * Rules. Diese Maske zeigt nur an.
 */
export function ModeratorLogin() {
  const signIn = useAdminAccess((s) => s.signIn)
  const signInWith = useAdminAccess((s) => s.signInWith)
  const signOut = useAdminAccess((s) => s.signOut)
  const busy = useAdminAccess((s) => s.busy)
  const error = useAdminAccess((s) => s.error)
  const uid = useAdminAccess((s) => s.uid)
  const email = useAdminAccess((s) => s.email)

  const [eingabe, setEingabe] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="prose-column">
      <PageTitle kicker="Nur für die Moderation">Anmeldung</PageTitle>
      <p className="text-muted">
        Verifizierungsanträge, Chatverläufe und Meldungen sind nur mit dem Moderationskonto einsehbar.
      </p>

      {/* Angemeldet und trotzdem draussen: Ohne diesen Hinweis bleibt nur Raten. */}
      {uid ? (
        <Note tone="warn" as="div" className="mt-5">
          <p>
            Angemeldet {email ? <>als <span className="font-mono">{email}</span></> : null} – aber mit einer anderen
            Kennung als der hinterlegten.
          </p>
          <dl className="mt-2 flex flex-col gap-1 font-mono text-xs">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted">dieses Konto</dt>
              <dd>{uid}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted">Moderation</dt>
              <dd>{MODERATOR_UID}</dd>
            </div>
          </dl>
          <p className="mt-2">
            Dieselbe Adresse kann in Firebase mehrere Konten haben, wenn sie über verschiedene Wege angelegt wurde.
            Stimmen die beiden Zeilen nicht überein, hilft nur: abmelden und mit dem Weg anmelden, über den das
            Moderationskonto entstanden ist.
          </p>
          <div className="mt-3">
            <Button size="sm" disabled={busy} onClick={() => void signOut()}>
              Abmelden
            </Button>
          </div>
        </Note>
      ) : null}

      <Panel className="mt-6 flex flex-col gap-5 p-5">
        {ANMELDEARTEN.google || ANMELDEARTEN.apple ? (
          <div className="flex flex-col gap-3">
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
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="label-caps">oder</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ) : null}

        {ANMELDEARTEN.passwort ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void signIn(eingabe, password)
            }}
          >
            <Field label="E-Mail" htmlFor="mod-email">
              <input
                id="mod-email"
                type="email"
                autoComplete="username"
                className={inputClass}
                value={eingabe}
                onChange={(event) => setEingabe(event.target.value)}
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

            <div>
              <Button type="submit" variant="primary" disabled={busy || !eingabe || !password}>
                {busy ? 'Wird geprüft …' : 'Anmelden'}
              </Button>
            </div>
          </form>
        ) : null}

        {error ? <Note tone="warn">{error}</Note> : null}
      </Panel>

      <p className="mt-4 text-sm text-muted">
        Ein Konto, das über Google oder Apple angelegt wurde, hat kein Passwort – dort führt nur der jeweilige Knopf
        hinein.
      </p>
    </div>
  )
}
