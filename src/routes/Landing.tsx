import { Link } from 'react-router-dom'
import { Panel } from '../components/ui'
import { ShieldMark } from '../components/VerifiedBadge'
import { Wortmarke } from '../components/Logo'
import { AktionsHinweis } from '../components/AktionsHinweis'
import { artLabel, datumLang } from '../services/neuigkeiten'
import { useNeuigkeiten } from '../store/useNeuigkeiten'
import { BETREIBER } from '../content/legal'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'

const ABLAUF = [
  {
    titel: 'Konto und Ausweis',
    text: 'Du meldest dich an, bestätigst deine Mobilnummer und lädst ein Ausweisfoto und ein Selfie hoch. Ein Mensch prüft die Angaben.',
  },
  {
    titel: 'Anonym bleiben',
    text: 'Im Chat siehst du nur einen zufälligen Anzeigenamen. Und dass dein Gegenüber ebenfalls verifiziert ist.',
  },
  {
    titel: 'Chatten, weiter, melden',
    text: 'Ein Klick, und du chattest mit jemandem. Passt es nicht, gehst du weiter. Wird jemand übergriffig, meldest du die Person.',
  },
]

const SICHERHEIT = [
  {
    titel: 'Gesperrt heisst gesperrt',
    text: 'Hinter jedem Konto steht eine verifizierte Person. Wer gesperrt wird, kann nicht einfach ein neues Konto anlegen.',
  },
  {
    titel: 'Kein Chatverlauf',
    text: 'Nach dem Gespräch ist der Chat für euch beide weg. Für die Missbrauchsprüfung bewahren wir ihn 72 Stunden auf, dann wird er gelöscht. Jeder Zugriff der Moderation wird protokolliert.',
  },
  {
    titel: 'Du bestimmst, mit wem',
    text: 'Du wählst die Sprache. Mit Plus kannst du zusätzlich nach Interessen suchen. Wen du nicht mehr treffen willst, blockierst du, auch ohne Meldung.',
  },
]

export function Landing() {
  const konto = useAuth((s) => s.user)
  const user = useSession((s) => s.user)

  const neueste = useNeuigkeiten((s) => s.liste[0])

  const ziel = !konto ? '/anmelden' : user?.verified ? '/chat' : '/verifizierung'
  const label = !konto ? 'Konto anlegen' : user?.verified ? 'Chat starten' : 'Verifizierung abschliessen'

  return (
    <div className="flex flex-col gap-14">
      <section>
        <div className="mb-5">
          <Wortmarke className="h-12 sm:h-16" />
        </div>
        <p className="label-caps mb-3">Identität spielt keine Rolle</p>
        <h1 className="font-display text-4xl leading-[1.1] font-semibold text-balance sm:text-5xl">
          Anonym chatten. <br className="sm:hidden" />
          Mit echten Menschen.
        </h1>
        <p className="prose-column mt-5 text-lg text-muted">
          Alle hier haben sich mit einem Ausweis verifiziert. Im Chat sieht man davon nur ein Siegel und einen
          zufälligen Anzeigenamen. Wer sich danebenbenimmt, fliegt raus und kommt nicht wieder.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            to={ziel}
            className="inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-5 py-3 font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            <ShieldMark />
            {label}
          </Link>
          {!konto ? (
            <Link to="/anmelden" className="rounded-sm px-3 py-2.5 text-muted underline underline-offset-4 transition-colors hover:text-ink">
              Ich habe schon ein Konto
            </Link>
          ) : null}
          <span className="text-sm text-muted">
            Ab 18 · Gratis nutzbar ·{' '}
            <Link to="/preise" className="underline underline-offset-2 hover:text-ink">
              Tarife
            </Link>
          </span>
        </div>
      </section>

      <AktionsHinweis mitLink />

      {neueste ? (
        <Link
          to="/neuigkeiten"
          className="group flex flex-col gap-1 rounded-sm border border-line bg-surface px-5 py-4 transition-colors hover:border-accent sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="label-caps shrink-0 text-accent-strong">
            {artLabel(neueste.art)} · {datumLang(neueste.datum)}
          </span>
          <span className="min-w-0 flex-1 font-medium">{neueste.titel}</span>
          <span className="shrink-0 text-sm text-muted underline underline-offset-4 group-hover:text-ink">
            Alle Neuigkeiten
          </span>
        </Link>
      ) : null}

      <section aria-labelledby="ablauf">
        <h2 id="ablauf" className="label-caps mb-4">
          So läuft es
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
          {ABLAUF.map((schritt, index) => (
            <li key={schritt.titel} className="flex flex-col gap-2 bg-surface p-5">
              <span className="font-mono text-xs text-accent-strong">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="font-display text-xl font-semibold">{schritt.titel}</h3>
              <p className="text-sm text-muted">{schritt.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sicherheit">
        <h2 id="sicherheit" className="font-display text-2xl font-semibold">
          Warum es hier anders zugeht
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {SICHERHEIT.map((punkt) => (
            <Panel key={punkt.titel} className="p-5">
              <h3 className="font-display text-lg font-semibold">{punkt.titel}</h3>
              <p className="mt-2 text-sm text-muted">{punkt.text}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-line bg-surface p-6">
        <h2 className="font-display text-2xl font-semibold">Was wir über dich wissen</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="label-caps mb-2">Andere sehen</p>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li>Deinen Anzeigenamen</li>
              <li>Dass du verifiziert bist</li>
              <li>Ob du gerade am Gerät bist und schreibst</li>
            </ul>
          </div>
          <div>
            <p className="label-caps mb-2">Andere sehen nicht</p>
            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              <li>Deinen Namen, dein Konto, deine Adresse</li>
              <li>Deine Mobilnummer</li>
              <li>Dein Ausweisfoto oder dein Selfie</li>
              <li>Deine Sprache, Altersgruppe und Interessen</li>
              <li>Frühere Chats – auch du siehst sie nicht mehr</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="offenheit" className="prose-column">
        <h2 id="offenheit" className="font-display text-2xl font-semibold">
          Was wir nicht versprechen
        </h2>
        <p className="mt-3 text-muted">
          Die Verifizierung bestätigt, dass am anderen Ende eine volljährige Person mit geprüftem Ausweis sitzt. Wie
          sich diese Person verhält, kann sie nicht garantieren. Trotz Wortfilter und Moderation können dir sexuelle,
          verstörende oder beleidigende Nachrichten begegnen. Du nimmst auf eigene Verantwortung teil. Melden dauert
          zwei Klicks, und jede Meldung sieht sich ein Mensch an.
        </p>
      </section>

      <section aria-labelledby="hilfe" className="prose-column">
        <h2 id="hilfe" className="font-display text-2xl font-semibold">
          Fragen und Hilfe
        </h2>
        <p className="mt-3 text-muted">
          Mit Konto erreichst du uns{' '}
          {konto ? (
            <>
              über die{' '}
              <Link to="/support" className="text-ink underline underline-offset-2 hover:text-accent-strong">
                Supportseite
              </Link>
            </>
          ) : (
            <>
              nach der{' '}
              <Link to="/anmelden" className="text-ink underline underline-offset-2 hover:text-accent-strong">
                Anmeldung
              </Link>{' '}
              über die Supportseite
            </>
          )}
          . Dort gibt es ein Formular mit Bildanhang und, wenn nötig, einen Chat mit der Moderation. Hast du kein
          Konto oder kommst du nicht mehr hinein, schreib eine Mail an{' '}
          <span className="font-mono text-ink">{BETREIBER.email}</span>.
        </p>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-accent/40 bg-accent-soft p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold">Bereit?</h2>
          <p className="mt-1 text-sm text-muted">Die Verifizierung machst du nur einmal. Das Einreichen dauert ein paar Minuten.</p>
        </div>
        <Link
          to={ziel}
          className="inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-5 py-3 font-medium text-accent-ink transition-opacity hover:opacity-90"
        >
          {label}
        </Link>
      </section>
    </div>
  )
}
