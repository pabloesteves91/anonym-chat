import { Link } from 'react-router-dom'
import { Note, Panel } from '../components/ui'
import { ShieldMark } from '../components/VerifiedBadge'
import { useSession } from '../store/useSession'

const SCHRITTE = [
  {
    titel: 'Einmal ausweisen',
    text: 'Mobilnummer per SMS, Foto des Ausweises, Selfie dazu – einmalig, bevor der erste Chat möglich ist.',
  },
  {
    titel: 'Anonym auftreten',
    text: 'Nach aussen nur ein zufälliger Anzeigename. Kein Klarname, kein Foto, kein Profilbesuch.',
  },
  {
    titel: 'Sperren, die halten',
    text: 'Weil im Hintergrund eine von Hand geprüfte Identität steht, trifft eine Sperre die Person – nicht nur ein Konto.',
  },
]

export function Landing() {
  const user = useSession((s) => s.user)
  const verified = Boolean(user?.verified)

  return (
    <div className="flex flex-col gap-10">
      <section>
        <p className="label-caps mb-3">Zufallschat mit Ausweispflicht</p>
        <h1 className="font-display text-4xl leading-[1.1] font-semibold text-balance sm:text-5xl">
          Anonym gegenüber einander. Eindeutig gegenüber dem System.
        </h1>
        <p className="prose-column mt-5 text-lg text-muted">
          Wer hier mitschreibt, hat sich einmal ausgewiesen – bestätigte Mobilnummer, Ausweisfoto, Selfie, von einem
          Menschen geprüft. Gesehen wird davon nichts ausser einem Siegel: Das Gegenüber erfährt nur einen zufälligen
          Anzeigenamen, während das System die Person kennt. Genau deshalb wirkt eine Sperre dauerhaft und nicht nur
          bis zum nächsten neuen Konto.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {verified ? (
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-4 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              Chat starten
            </Link>
          ) : (
            <Link
              to="/verifizierung"
              className="inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-4 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              <ShieldMark />
              Verifizierung starten
            </Link>
          )}
          <Link to="/profil" className="rounded-sm px-3 py-2.5 text-muted transition-colors hover:text-ink">
            {verified ? 'Profil ansehen' : 'Zuerst umschauen'}
          </Link>
        </div>
      </section>

      <section aria-labelledby="ablauf">
        <h2 id="ablauf" className="label-caps mb-4">
          Ablauf
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
          {SCHRITTE.map((schritt, index) => (
            <li key={schritt.titel} className="flex flex-col gap-2 bg-surface p-5">
              <span className="font-mono text-xs text-accent">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="font-display text-xl font-semibold">{schritt.titel}</h3>
              <p className="text-sm text-muted">{schritt.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <Panel className="border-accent/40 p-5">
        <h2 className="font-display text-xl font-semibold">So testest du das hier</h2>
        <ol className="mt-3 flex flex-col gap-2 text-sm">
          <li>
            <span className="font-mono text-xs text-accent">01</span> Mobilnummer eingeben – der SMS-Code erscheint
            direkt auf dem Bildschirm, es geht keine echte SMS raus.
          </li>
          <li>
            <span className="font-mono text-xs text-accent">02</span> Beim Ausweisfoto und beim Selfie auf
            „Demo-Bild einsetzen" tippen. Für den Test braucht es kein echtes Foto von dir.
          </li>
          <li>
            <span className="font-mono text-xs text-accent">03</span> Du bist gleichzeitig die Moderation: den eigenen
            Antrag unter <span className="text-ink">Moderation</span> freigeben, dann ist der Chat offen.
          </li>
          <li>
            <span className="font-mono text-xs text-accent">04</span> Nochmal von vorn? Im Profil ganz unten
            „Zurücksetzen".
          </li>
        </ol>
      </Panel>

      <Panel className="p-5">
        <h2 className="font-display text-xl font-semibold">Was dieser Prototyp nicht tut</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
          <li>— Keine echte SMS: der Code steht im Prototyp direkt auf dem Bildschirm.</li>
          <li>— Keine echte Ausweisprüfung. Die Fotos bleiben auf diesem Gerät und werden nach dem Entscheid gelöscht.</li>
          <li>— Kein Server, keine anderen Menschen: die Gegenüber sind Skript-Attrappen, und du bist gleichzeitig die Moderation.</li>
          <li>— Kein Video, kein Audio, keine Bezahlung.</li>
        </ul>
        <div className="mt-4">
          <Note>
            Alles bleibt in diesem Browser. Verifizierungsstatus, Profil und Meldungen liegen in localStorage, die
            Ausweisbilder nur im Sitzungsspeicher – zurücksetzen lässt sich alles im Profil.
          </Note>
        </div>
      </Panel>
    </div>
  )
}
