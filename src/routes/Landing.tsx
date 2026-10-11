import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Panel } from '../components/ui'
import { buttonClass } from '../components/buttonClass'
import { ShieldMark, VerifiedBadge } from '../components/VerifiedBadge'
import { Shimmer } from '../components/magic/Shimmer'
import { ShinyText } from '../components/magic/ShinyText'
import { GridPattern } from '../components/magic/GridPattern'
import { Spotlight } from '../components/magic/Spotlight'
import { AktionsHinweis } from '../components/AktionsHinweis'
import { artLabel, datumLang } from '../services/neuigkeiten'
import { useNeuigkeiten } from '../store/useNeuigkeiten'
import { BETREIBER } from '../content/legal'
import { INSTAGRAM } from '../content/kanaele'
import { InstagramMark } from '../components/ProviderMarks'
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

/** Gestaffeltes Erscheinen im Startbereich. */
const nach = (sekunden: number) => ({ '--verzoegerung': `${sekunden}s` }) as CSSProperties

/**
 * So sieht ein Chat aus – als Bild, nicht als echter Verlauf. Die Zeilen
 * sind Beispiele aus den Gesprächsvorschlägen.
 */
function ChatVorschau() {
  return (
    <Panel hervorgehoben className="overflow-hidden p-4 sm:p-5" as="div">
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex items-center gap-3 border-b border-line pb-3">
          <div className="min-w-0">
            <p className="font-mono text-sm text-ink">Stille Amsel 2098</p>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
              anwesend
            </p>
          </div>
          <span className="ml-auto">
            <VerifiedBadge status="verifiziert" size="sm" />
          </span>
        </div>
        <p className="max-w-[85%] self-start rounded-[18px] rounded-bl-md border border-line bg-raised px-3.5 py-2.5 text-[0.9375rem]">
          Bist du eher Morgenmensch oder Nachteule?
        </p>
        <p className="max-w-[85%] self-end rounded-[18px] rounded-br-md bg-linear-to-br from-accent-bright to-accent px-3.5 py-2.5 text-[0.9375rem] text-accent-ink">
          Nachteule, ganz klar. Und du?
        </p>
        <p className="flex items-center gap-2 text-xs text-muted">
          <span className="flex gap-1">
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted [animation-delay:0.2s]" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted [animation-delay:0.4s]" />
          </span>
          Stille Amsel schreibt …
        </p>
      </div>
    </Panel>
  )
}

function Abschnitt({ id, titel, kicker, children }: { id: string; titel?: string; kicker?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="einblenden">
      {kicker ? (
        <h2 id={id} className="label-caps mb-4 text-accent-strong">
          {kicker}
        </h2>
      ) : (
        <h2 id={id} className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
          {titel}
        </h2>
      )}
      {children}
    </section>
  )
}

function Punkt({ ja, children }: { ja: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" fill="none">
        {ja ? (
          <>
            <circle cx="8" cy="8" r="7.25" className="stroke-accent/50" />
            <path d="M5 8.2l2 2 4-4.4" className="stroke-accent-strong" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <circle cx="8" cy="8" r="7.25" className="stroke-line-strong" />
            <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" className="stroke-muted" strokeWidth="1.4" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span className={ja ? '' : 'text-muted'}>{children}</span>
    </li>
  )
}

export function Landing() {
  const konto = useAuth((s) => s.user)
  const user = useSession((s) => s.user)

  const neueste = useNeuigkeiten((s) => s.liste[0])

  const ziel = !konto ? '/anmelden' : user?.verified ? '/chat' : '/verifizierung'
  const label = !konto ? 'Konto anlegen' : user?.verified ? 'Chat starten' : 'Verifizierung abschliessen'

  return (
    <div className="flex flex-col gap-20 sm:gap-28">
      <section className="relative -mx-4 -mt-8 overflow-hidden px-4 pt-10 pb-4 sm:pt-16">
        <GridPattern className="text-accent/[0.09] mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,#000_40%,transparent_100%)]" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="erscheinen mb-6 inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface/70 px-3.5 py-1.5 backdrop-blur" style={nach(0)}>
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" aria-hidden="true" />
              <ShinyText className="label-caps text-muted/70">Identität spielt keine Rolle</ShinyText>
            </p>
            <h1 className="erscheinen font-display text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.1rem]" style={nach(0.08)}>
              Anonym chatten. <span className="text-verlauf">Mit echten Menschen.</span>
            </h1>
            <p className="erscheinen prose-column mt-6 text-lg text-muted" style={nach(0.16)}>
              Alle hier haben sich mit einem Ausweis verifiziert. Im Chat sieht man davon nur ein Siegel und einen
              zufälligen Anzeigenamen. Wer sich danebenbenimmt, fliegt raus und kommt nicht wieder.
            </p>

            <div className="erscheinen mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" style={nach(0.24)}>
              <Link to={ziel} className={buttonClass('primary', 'md', 'w-full sm:w-auto')}>
                <Shimmer />
                <ShieldMark />
                {label}
              </Link>
              {!konto ? (
                <Link to="/anmelden" className={buttonClass('secondary', 'md', 'w-full sm:w-auto')}>
                  Ich habe schon ein Konto
                </Link>
              ) : null}
            </div>
            <p className="erscheinen mt-5 text-sm text-muted" style={nach(0.3)}>
              Ab 18 · Gratis nutzbar ·{' '}
              <Link to="/preise" className="text-accent-strong underline-offset-4 hover:underline">
                Tarife
              </Link>
            </p>
          </div>

          <div className="erscheinen" style={nach(0.36)}>
            <ChatVorschau />
          </div>
        </div>
      </section>

      <AktionsHinweis mitLink />

      {neueste ? (
        <Link
          to="/neuigkeiten"
          className="group einblenden flex flex-col gap-1 rounded-2xl border border-line bg-surface/80 px-5 py-4 shadow-karte transition-colors hover:border-accent/50 sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="label-caps shrink-0 text-accent-strong">
            {artLabel(neueste.art)} · {datumLang(neueste.datum)}
          </span>
          <span className="min-w-0 flex-1 font-medium">{neueste.titel}</span>
          <span className="shrink-0 text-sm text-muted transition-colors group-hover:text-ink">Alle Neuigkeiten →</span>
        </Link>
      ) : null}

      <Abschnitt id="ablauf" kicker="So läuft es">
        <ol className="grid gap-4 sm:grid-cols-3">
          {ABLAUF.map((schritt, index) => (
            <li key={schritt.titel}>
              <Panel as="div" className="flex h-full flex-col gap-3 p-6">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent/35 bg-accent-soft font-mono text-xs text-accent-strong">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">{schritt.titel}</h3>
                <p className="text-sm text-muted">{schritt.text}</p>
              </Panel>
            </li>
          ))}
        </ol>
      </Abschnitt>

      <Abschnitt id="sicherheit" titel="Warum es hier anders zugeht">
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {SICHERHEIT.map((punkt) => (
            <Spotlight key={punkt.titel} className="rounded-2xl border border-line bg-surface shadow-karte">
              <div className="relative p-6">
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">{punkt.titel}</h3>
                <p className="mt-2 text-sm text-muted">{punkt.text}</p>
              </div>
            </Spotlight>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt id="wissen" titel="Was wir über dich wissen">
        <Panel as="div" className="mt-6 grid gap-8 p-6 sm:grid-cols-2 sm:p-8">
          <div>
            <p className="label-caps mb-4">Andere sehen</p>
            <ul className="flex flex-col gap-3">
              <Punkt ja>Deinen Anzeigenamen</Punkt>
              <Punkt ja>Dass du verifiziert bist</Punkt>
              <Punkt ja>Ob du gerade am Gerät bist und schreibst</Punkt>
            </ul>
          </div>
          <div className="border-t border-line pt-8 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
            <p className="label-caps mb-4">Andere sehen nicht</p>
            <ul className="flex flex-col gap-3">
              <Punkt ja={false}>Deinen Namen, dein Konto, deine Adresse</Punkt>
              <Punkt ja={false}>Deine Mobilnummer</Punkt>
              <Punkt ja={false}>Dein Ausweisfoto oder dein Selfie</Punkt>
              <Punkt ja={false}>Deine Sprache, Altersgruppe und Interessen</Punkt>
              <Punkt ja={false}>Frühere Chats – auch du siehst sie nicht mehr</Punkt>
            </ul>
          </div>
        </Panel>
      </Abschnitt>

      <Abschnitt id="offenheit" titel="Was wir nicht versprechen">
        <p className="prose-column mt-5 border-l-2 border-accent/60 pl-5 text-muted">
          Die Verifizierung bestätigt, dass am anderen Ende eine volljährige Person mit geprüftem Ausweis sitzt. Wie
          sich diese Person verhält, kann sie nicht garantieren. Trotz Wortfilter und Moderation können dir sexuelle,
          verstörende oder beleidigende Nachrichten begegnen. Du nimmst auf eigene Verantwortung teil. Melden dauert
          zwei Klicks, und jede Meldung sieht sich ein Mensch an.
        </p>
      </Abschnitt>

      <Abschnitt id="hilfe" titel="Fragen und Hilfe">
        <div className="prose-column">
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
            <a href={`mailto:${BETREIBER.email}`} className="text-ink underline underline-offset-2 hover:text-accent-strong">
              {BETREIBER.email}
            </a>
            .
          </p>
          <p className="mt-3 text-muted">
            Neuigkeiten und Einblicke gibt es auch auf Instagram:{' '}
            <a
              href={INSTAGRAM.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-ink underline underline-offset-2 hover:text-accent-strong"
            >
              <InstagramMark className="h-4 w-4 shrink-0" />
              {INSTAGRAM.name}
            </a>
          </p>
        </div>
      </Abschnitt>

      <Panel hervorgehoben className="einblenden overflow-hidden bg-linear-to-br from-accent-soft to-surface p-7 sm:p-10">
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.03em]">Bereit?</h2>
            <p className="mt-2 text-muted">Die Verifizierung machst du nur einmal. Das Einreichen dauert ein paar Minuten.</p>
          </div>
          <Link to={ziel} className={buttonClass('primary', 'md', 'w-full shrink-0 sm:w-auto')}>
            <Shimmer />
            {label}
          </Link>
        </div>
      </Panel>
    </div>
  )
}
