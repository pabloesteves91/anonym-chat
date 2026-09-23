import { Link } from 'react-router-dom'
import { hinweis, laufendeAktionen, type Aktion } from '../services/aktion'
import { useAktionen } from '../store/useAktionen'

function Hinweis({ aktion, mitLink }: { aktion: Aktion; mitLink: boolean }) {
  const { titel, punkte } = hinweis(aktion)
  return (
    <section
      aria-label={`Aktion: ${titel}`}
      className="rounded-sm border border-accent/45 bg-accent-soft p-5 sm:p-6"
    >
      <p className="label-caps text-accent-strong">{aktion.code ? `Gutschein ${aktion.code}` : 'Aktion'}</p>
      <h2 className="mt-1 font-display text-2xl font-semibold">{titel}</h2>
      {punkte.length ? (
        <ul className="mt-3 flex flex-col gap-1.5 text-[0.9375rem]">
          {punkte.map((punkt) => (
            <li key={punkt} className="whitespace-pre-line">
              {punkt}
            </li>
          ))}
        </ul>
      ) : null}
      {mitLink ? (
        <p className="mt-3">
          <Link to="/preise" className="text-sm font-medium text-accent-strong underline underline-offset-4">
            Zu den Tarifen
          </Link>
        </p>
      ) : null}
    </section>
  )
}

/**
 * Hinweise auf laufende Aktionen – nur solange etwas davon gilt.
 *
 * Steht auf der Startseite und über den Tarifen: eine Karte pro Aktion, mit
 * dem eigenen Text der Verwaltung oder einem aus den Werten erzeugten, der
 * beide Teile mit Enddatum nennt. Ein eingelöster Gutschein erscheint nur
 * bei der Person, die ihn eingelöst hat.
 */
export function AktionsHinweis({ mitLink = false }: { mitLink?: boolean }) {
  const aktionen = useAktionen((s) => s.aktionen)
  const gutschein = useAktionen((s) => s.gutschein)
  const laufend = laufendeAktionen(gutschein ? [...aktionen, gutschein] : aktionen)
  if (!laufend.length) return null
  return (
    <div className="flex flex-col gap-4">
      {laufend.map((aktion) => (
        <Hinweis key={aktion.id} aktion={aktion} mitLink={mitLink} />
      ))}
    </div>
  )
}
