import { Button, Field, Note, Panel, TagToggle, inputClass } from './ui'
import { INTERESTS, LANGUAGES } from '../services/types'
import type { Language } from '../services/types'
import { useChat } from '../store/useChat'

/** Ausgangszustand: Filter setzen und Suche starten. */
export function Lobby() {
  const filter = useChat((s) => s.filter)
  const setFilter = useChat((s) => s.setFilter)
  const startSearch = useChat((s) => s.startSearch)
  const error = useChat((s) => s.error)

  const toggleInterest = (interest: string) =>
    setFilter({
      ...filter,
      interests: filter.interests.includes(interest)
        ? filter.interests.filter((i) => i !== interest)
        : [...filter.interests, interest],
    })

  return (
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

        <fieldset className="border-0 p-0">
          <legend className="label-caps mb-2">Interessen · mindestens eine Übereinstimmung</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((interest) => (
              <TagToggle
                key={interest}
                label={interest}
                active={filter.interests.includes(interest)}
                onToggle={() => toggleInterest(interest)}
              />
            ))}
          </div>
        </fieldset>

        {error ? <Note tone="warn">{error}</Note> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => void startSearch()}>
            Chat starten
          </Button>
          {filter.interests.length > 0 || filter.language !== 'egal' ? (
            <Button variant="quiet" onClick={() => setFilter({ language: 'egal', interests: [] })}>
              Filter zurücksetzen
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}
