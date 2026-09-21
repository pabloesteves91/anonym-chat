import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Field, Note, Panel, TagToggle, inputClass } from './ui'
import { CodexDialog } from './CodexDialog'
import { useSession } from '../store/useSession'
import { INTERESTS, LANGUAGES } from '../services/types'
import type { Language } from '../services/types'
import { grenzen, verbleibend } from '../services/plans'
import { useChat } from '../store/useChat'

/** Ausgangszustand: Filter setzen und Suche starten. */
export function Lobby() {
  const filter = useChat((s) => s.filter)
  const setFilter = useChat((s) => s.setFilter)
  const startSearch = useChat((s) => s.startSearch)
  const error = useChat((s) => s.error)
  const codexAccepted = useSession((s) => s.codexAccepted)
  const acceptCodex = useSession((s) => s.acceptCodex)
  const selfBlocked = useSession((s) => s.selfBlocked)
  const user = useSession((s) => s.user)
  const [codexOpen, setCodexOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const darfFiltern = grenzen(user?.membership).interessenFilter
  const uebrig = verbleibend(user?.membership, user?.usage)

  const start = () => {
    if (!codexAccepted) {
      setCodexOpen(true)
      return
    }
    void startSearch()
  }

  const acceptAndStart = async () => {
    setBusy(true)
    await acceptCodex()
    setBusy(false)
    setCodexOpen(false)
    void startSearch()
  }

  const toggleInterest = (interest: string) =>
    setFilter({
      ...filter,
      interests: filter.interests.includes(interest)
        ? filter.interests.filter((i) => i !== interest)
        : [...filter.interests, interest],
    })

  return (
    <>
      <Panel className="p-5">
      <h2 className="font-display text-2xl font-semibold">Neuer Chat</h2>
      <p className="mt-1 text-sm text-muted">
        Der Filter ist optional. Je enger er gesetzt ist, desto länger kann die Suche dauern.
      </p>

      <div className="mt-5 flex flex-col gap-5">
        <Field label="Sprache" htmlFor="filter-sprache">
          <select
            id="filter-sprache"
            className={`${inputClass} sm:max-w-xs`}
            value={filter.language}
            onChange={(event) => setFilter({ ...filter, language: event.target.value as Language | 'egal' })}
          >
            <option value="egal">Egal</option>
            {LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </Field>

        <fieldset className="border-0 p-0" disabled={!darfFiltern}>
          <legend className="label-caps mb-2">
            Interessen · mindestens eine Übereinstimmung
            {darfFiltern ? null : <span className="ml-2 text-accent">mit Plus</span>}
          </legend>
          <div className={`flex flex-wrap gap-2 ${darfFiltern ? '' : 'opacity-50'}`}>
            {INTERESTS.map((interest) => (
              <TagToggle
                key={interest}
                label={interest}
                active={filter.interests.includes(interest)}
                onToggle={() => toggleInterest(interest)}
              />
            ))}
          </div>
          {darfFiltern ? null : (
            <p className="mt-2 text-sm text-muted">
              Im Gratistarif wird nach Sprache gesucht.{' '}
              <Link to="/preise" className="underline underline-offset-2 hover:text-ink">
                Tarife ansehen
              </Link>
            </p>
          )}
        </fieldset>

        {error ? <Note tone="warn">{error}</Note> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={start}>
            Chat starten
          </Button>
          {filter.interests.length > 0 || filter.language !== 'egal' ? (
            <Button variant="quiet" onClick={() => setFilter({ language: 'egal', interests: [] })}>
              Filter zurücksetzen
            </Button>
          ) : null}
        </div>

        {uebrig !== null ? (
          <p className="text-sm text-muted">
            Heute noch {uebrig} {uebrig === 1 ? 'Chat' : 'Chats'} im Gratistarif.{' '}
            <Link to="/preise" className="underline underline-offset-2 hover:text-ink">
              Unbegrenzt mit Plus
            </Link>
          </p>
        ) : null}

        {selfBlocked.length > 0 ? (
          <p className="text-sm text-muted">
            {selfBlocked.length} {selfBlocked.length === 1 ? 'Konto ist' : 'Konten sind'} für dich blockiert und
            {selfBlocked.length === 1 ? ' wird' : ' werden'} nicht mehr zugelost. Aufheben lässt sich das im Profil.
          </p>
        ) : null}
      </div>
      </Panel>

      <CodexDialog
        open={codexOpen}
        onClose={() => setCodexOpen(false)}
        onAccept={() => void acceptAndStart()}
        busy={busy}
      />
    </>
  )
}
