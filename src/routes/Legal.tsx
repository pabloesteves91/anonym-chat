import { Link } from 'react-router-dom'
import { Note, PageTitle, Panel } from '../components/ui'
import { BETREIBER_UNVOLLSTAENDIG, RECHTSTEXTE, STAND, type Rechtstext } from '../content/legal'

/**
 * Rechtstexte in einer Vorlage.
 *
 * Inhalt steht in `content/legal.ts`, damit die Angaben zum Betreiber genau
 * einmal gepflegt werden – und nicht verstreut über drei Seiten.
 */
function Seite({ text }: { text: Rechtstext }) {
  return (
    <div className="prose-column flex flex-col gap-6">
      <div>
        <PageTitle kicker={text.kicker}>{text.titel}</PageTitle>
        <p className="text-muted">{text.vorspann}</p>
      </div>

      {BETREIBER_UNVOLLSTAENDIG ? (
        <Note tone="warn">
          Diese Seite enthält noch Platzhalter. Vor dem öffentlichen Start müssen die Angaben zum Betreiber in
          <span className="font-mono"> src/content/legal.ts </span> eingetragen werden – ohne sie ist das Impressum
          nicht rechtskonform.
        </Note>
      ) : null}

      <Panel className="flex flex-col gap-6 p-5">
        {text.abschnitte.map((abschnitt) => (
          <section key={abschnitt.titel}>
            <h2 className="font-display text-xl font-semibold">{abschnitt.titel}</h2>
            {abschnitt.absaetze?.map((absatz) => (
              <p key={absatz} className="mt-2 text-muted">
                {absatz}
              </p>
            ))}
            {abschnitt.liste ? (
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-muted marker:text-accent">
                {abschnitt.liste.map((punkt) => (
                  <li key={punkt}>{punkt}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </Panel>

      <p className="text-sm text-muted">
        Stand: {STAND}. Weitere Seiten:{' '}
        {RECHTSTEXTE.filter((anderer) => anderer.slug !== text.slug).map((anderer, index) => (
          <span key={anderer.slug}>
            {index > 0 ? ' · ' : ''}
            <Link to={`/${anderer.slug}`} className="underline underline-offset-2 hover:text-ink">
              {anderer.titel}
            </Link>
          </span>
        ))}
      </p>
    </div>
  )
}

export function Impressum() {
  return <Seite text={RECHTSTEXTE[0]} />
}

export function Datenschutz() {
  return <Seite text={RECHTSTEXTE[1]} />
}

export function Nutzungsbedingungen() {
  return <Seite text={RECHTSTEXTE[2]} />
}
