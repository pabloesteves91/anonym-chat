import { TagToggle } from './ui'
import { INTEREST_GRUPPEN, INTERESTS } from '../services/types'

/**
 * Die Interessen, nach Gruppen geordnet – für Profil und Suchfilter.
 *
 * Die Gruppen sind nur Überschriften; gespeichert wird der Begriff. Ein
 * gespeicherter Begriff, den es in der Liste nicht (mehr) gibt, erscheint
 * unter „Weitere", damit er sich abwählen lässt.
 */
export function InteressenAuswahl({
  gewaehlt,
  onToggle,
  max,
}: {
  gewaehlt: string[]
  onToggle: (interesse: string) => void
  /** Höchstens so viele; weitere lassen sich erst nach dem Abwählen setzen. */
  max: number
}) {
  const voll = gewaehlt.length >= max
  const unbekannt = gewaehlt.filter((i) => !(INTERESTS as readonly string[]).includes(i))
  const gruppen = [
    ...INTEREST_GRUPPEN.map((g) => ({ titel: g.titel, interessen: [...g.interessen] as string[] })),
    ...(unbekannt.length ? [{ titel: 'Weitere', interessen: unbekannt }] : []),
  ]

  return (
    <div className="flex flex-col gap-3">
      {gruppen.map((gruppe) => (
        <div key={gruppe.titel}>
          <p className="mb-1.5 text-xs font-medium text-muted">{gruppe.titel}</p>
          <div className="flex flex-wrap gap-2">
            {gruppe.interessen.map((interesse) => {
              const aktiv = gewaehlt.includes(interesse)
              return (
                <TagToggle
                  key={interesse}
                  label={interesse}
                  active={aktiv}
                  onToggle={() => {
                    if (!aktiv && voll) return
                    onToggle(interesse)
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}
      {voll ? <p className="text-xs text-muted">Höchstens {max} – zum Wechseln erst eines abwählen.</p> : null}
    </div>
  )
}
