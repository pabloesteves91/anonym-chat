import { Link } from 'react-router-dom'
import { Panel } from '../components/ui'
import { ShieldMark } from '../components/VerifiedBadge'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'

const ABLAUF = [
  {
    titel: 'Konto und Ausweis',
    text: 'Einmal anmelden, Mobilnummer bestätigen, Ausweisfoto und Selfie hochladen. Ein Mensch prüft die Angaben.',
  },
  {
    titel: 'Anonym auftreten',
    text: 'Im Chat siehst du nur einen zufälligen Anzeigenamen – und dass dein Gegenüber dieselbe Prüfung bestanden hat.',
  },
  {
    titel: 'Reden, wechseln, melden',
    text: 'Ein Klick verbindet dich mit jemandem. Passt es nicht, gehst du weiter. Wird jemand übergriffig, meldest du ihn.',
  },
]

const SICHERHEIT = [
  {
    titel: 'Sperren, die halten',
    text: 'Hinter jedem Konto steht eine geprüfte Person. Wer gesperrt wird, kommt nicht mit einem neuen Konto zurück.',
  },
  {
    titel: 'Niemand liest mit',
    text: 'Verläufe sind für beide Seiten nach dem Chat weg. Zur Missbrauchsprüfung bleiben sie 72 Stunden einsehbar, dann werden sie gelöscht – jeder Zugriff wird protokolliert.',
  },
  {
    titel: 'Du bestimmst, mit wem',
    text: 'Sprache und Interessen steuern, wer dir zugelost wird. Einzelne Konten kannst du dauerhaft ausschliessen, ohne jemanden zu melden.',
  },
]

export function Landing() {
  const konto = useAuth((s) => s.user)
  const user = useSession((s) => s.user)

  const ziel = !konto ? '/anmelden' : user?.verified ? '/chat' : '/verifizierung'
  const label = !konto ? 'Konto anlegen' : user?.verified ? 'Chat starten' : 'Verifizierung abschliessen'

  return (
    <div className="flex flex-col gap-14">
      <section>
        <p className="label-caps mb-3">Zufallschat mit Ausweispflicht</p>
        <h1 className="font-display text-4xl leading-[1.1] font-semibold text-balance sm:text-5xl">
          Reden mit Fremden, ohne mit jedem zu reden.
        </h1>
        <p className="prose-column mt-5 text-lg text-muted">
          Jede Person hier hat sich ausgewiesen. Gesehen wird davon nichts ausser einem Siegel – das Gegenüber kennt
          nur einen zufälligen Anzeigenamen. Genau deshalb bleibt es ruhig: Wer sich danebenbenimmt, ist weg und
          kommt nicht wieder.
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
          <span className="text-sm text-muted">Kostenlos · Keine Profile · Kein Klarname</span>
        </div>
      </section>

      <section aria-labelledby="ablauf">
        <h2 id="ablauf" className="label-caps mb-4">
          So läuft es
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
          {ABLAUF.map((schritt, index) => (
            <li key={schritt.titel} className="flex flex-col gap-2 bg-surface p-5">
              <span className="font-mono text-xs text-accent">{String(index + 1).padStart(2, '0')}</span>
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
              <li>Deinen zufälligen Anzeigenamen</li>
              <li>Dass du verifiziert bist</li>
              <li>Sprache und gemeinsame Interessen</li>
            </ul>
          </div>
          <div>
            <p className="label-caps mb-2">Andere sehen nicht</p>
            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              <li>Deinen Namen, dein Konto, deine Adresse</li>
              <li>Deine Mobilnummer</li>
              <li>Dein Ausweisfoto oder dein Selfie</li>
              <li>Frühere Chats – auch du siehst sie nicht mehr</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-accent/40 bg-accent-soft p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold">Bereit?</h2>
          <p className="mt-1 text-sm text-muted">Die Verifizierung dauert wenige Minuten und ist einmalig.</p>
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
