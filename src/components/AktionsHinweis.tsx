import { Link } from 'react-router-dom'
import { aktionsStand, datumKurz } from '../services/aktion'
import { useAktion } from '../store/useAktion'

/**
 * Der Hinweis auf die Release-Aktion – nur solange etwas davon gilt.
 *
 * Steht auf der Startseite und über den Tarifen. Er nennt beide Teile mit
 * Enddatum, damit niemand rätseln muss, was ab wann wieder kostet.
 */
export function AktionsHinweis({ mitLink = false }: { mitLink?: boolean }) {
  const aktion = useAktion((s) => s.aktion)
  const stand = aktionsStand(aktion)
  if (!stand.gratis && !stand.rabatt) return null

  return (
    <section
      aria-labelledby="release-aktion"
      className="rounded-sm border border-accent/45 bg-accent-soft p-5 sm:p-6"
    >
      <p className="label-caps text-accent-strong">Release-Aktion</p>
      <h2 id="release-aktion" className="mt-1 font-display text-2xl font-semibold">
        {stand.gratis ? 'Zum Start ist alles gratis.' : `Zum Start ${stand.rabatt} % auf alle Tarife.`}
      </h2>
      <ul className="mt-3 flex flex-col gap-1.5 text-[0.9375rem]">
        {stand.gratis && stand.gratisBis ? (
          <li>
            <strong>Bis und mit {datumKurz(stand.gratisBis)}</strong> alle Plus-Funktionen für jedes Konto – unbegrenzt
            chatten, Filter, eigener Anzeigename, bevorzugt in der Warteschlange. Ohne Buchung, ohne Zahlungsdaten.
          </li>
        ) : null}
        {stand.rabatt && stand.rabattBis ? (
          <li>
            <strong>Bis und mit {datumKurz(stand.rabattBis)}</strong> {stand.rabatt} % auf jeden Tarif. Bei Plus
            monatlich gilt der Rabatt für den ersten Monat, ab dem zweiten wird normal abgerechnet.
          </li>
        ) : null}
      </ul>
      {stand.gratis ? (
        <p className="mt-3 text-sm text-muted">
          Danach gilt wieder der gewählte Tarif; Gratiskonten fallen ohne Zutun auf „Frei" zurück. Es verlängert sich
          nichts von selbst.
        </p>
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
