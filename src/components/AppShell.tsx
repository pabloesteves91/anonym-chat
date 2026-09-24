import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Fehlergrenze } from './Fehlergrenze'
import { darfModerieren } from '../services/roles'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'
import { summeOffen, useOffene } from '../store/useOffene'
import { useSupport } from '../store/useSupport'
import { useAktionen } from '../store/useAktionen'
import { useNeuigkeiten } from '../store/useNeuigkeiten'
import { hatUngelesene } from '../services/neuigkeiten'
import { supportMenue } from '../services/support'
import { ShieldMark, VerifiedBadge } from './VerifiedBadge'
import { Wortmarke } from './Logo'
import { Button, Note, Panel } from './ui'
import { ThemeToggle } from './ThemeToggle'
import { TarifDialog } from './TarifDialog'
import { GeschlechtDialog } from './GeschlechtDialog'

/** Angemeldet, aber das Profil lässt sich nicht laden. */
function Profilfehler({ meldung }: { meldung: string }) {
  const erneut = useAuth((s) => s.user?.uid)
  const load = useSession((s) => s.load)
  const signOut = useAuth((s) => s.signOut)
  const busy = useSession((s) => s.loading)

  return (
    <div className="prose-column">
      <h1 className="font-display text-3xl font-semibold">Dein Profil lässt sich nicht laden</h1>
      <p className="mt-3 text-muted">
        Du bist angemeldet, aber die Daten zu deinem Konto kommen nicht an. Meistens liegt das an der Verbindung;
        seltener daran, dass dieses Konto keinen Zugriff hat.
      </p>
      <Panel className="mt-6 flex flex-col gap-4 p-5">
        <Note tone="warn">{meldung}</Note>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={busy || !erneut} onClick={() => erneut && void load(erneut)}>
            {busy ? 'Wird geladen …' : 'Erneut versuchen'}
          </Button>
          <Button disabled={busy} onClick={() => void signOut()}>
            Abmelden
          </Button>
        </div>
      </Panel>
    </div>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-sm px-2.5 py-1.5 text-sm transition-colors ${
    isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink'
  }`

/** Abgesetzt vom Rest: Die Moderation ist Werkzeug, nicht Angebot. */
const modClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-sm transition-colors ${
    isActive
      ? 'border-accent bg-accent-soft text-ink'
      : 'border-line-strong text-muted hover:border-accent hover:text-ink'
  }`

export function AppShell() {
  const konto = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)
  const user = useSession((s) => s.user)
  const storageAvailable = useSession((s) => s.storageAvailable)
  const profilFehler = useSession((s) => s.error)
  const { pathname } = useLocation()

  // Die Moderation ist kein Publikum: Dort hat ein Tarifangebot nichts
  // verloren, und ein Modal davor macht die Ansicht unbedienbar.
  //
  // Der Support steht aus einem anderen Grund auf derselben Liste: Der
  // Geschlechtsdialog lässt sich nicht wegklicken, solange die Angabe fehlt.
  // Wer zum Support will, *weil* er dort danebengegriffen hat, käme sonst nie
  // an – die Seite wäre genau für die Leute gesperrt, für die es sie gibt.
  const imModerationsbereich = pathname.startsWith('/admin')
  const ohneEinblendungen = imModerationsbereich || pathname.startsWith('/support')

  /**
   * Der Weg in die Moderation, nur für die berechtigte Kennung.
   *
   * Dieselbe Auswertung wie die Zugangsprüfung selbst, damit es nicht zwei
   * Meinungen darüber gibt, wer moderieren darf. Entschieden wird das
   * ohnehin auf dem Server: Ein eingeblendeter Knopf öffnet niemandem
   * Daten, den die Security Rules nicht hineinlassen.
   */
  const zeigtModeration = darfModerieren(konto?.uid)

  // Aktionen gelten für alle, angemeldet oder nicht. Wer den Stand abonniert,
  // rendert bei einer Änderung neu – und mit ihm alle Seiten, die
  // Tarifgrenzen oder Preise zeigen.
  const beobachteAktionen = useAktionen((z) => z.beobachte)
  useAktionen((z) => z.aktionen)
  useEffect(() => beobachteAktionen(), [beobachteAktionen])

  // Neuigkeiten, ebenfalls für alle. Ein Punkt am Menüpunkt, solange das
  // Gerät einen veröffentlichten Eintrag noch nicht gesehen hat.
  const beobachteNeuigkeiten = useNeuigkeiten((z) => z.beobachte)
  const neuigkeitNeu = useNeuigkeiten((z) => hatUngelesene(z.liste, z.gesehen))
  useEffect(() => beobachteNeuigkeiten(), [beobachteNeuigkeiten])
  const neuigkeitenLink = (
    <NavLink
      to="/neuigkeiten"
      className={(zustand) => `${navClass(zustand)} flex items-center gap-1.5`}
      aria-label={neuigkeitNeu ? 'Neuigkeiten – es gibt Neues' : undefined}
    >
      Neuigkeiten
      {neuigkeitNeu ? <span className="inline-block h-2 w-2 rounded-full bg-accent" aria-hidden="true" /> : null}
    </NavLink>
  )

  // Die laufende Zählung hängt am angemeldeten Konto und endet mit ihm.
  const beobachte = useOffene((z) => z.beobachte)
  const offen = useOffene(summeOffen)
  useEffect(() => {
    beobachte(konto?.uid ?? null)
  }, [beobachte, konto?.uid])

  // Die eigenen Supportanfragen, ebenfalls laufend: Sie tragen den Menüpunkt
  // "Support", der nur erscheint, wenn die Moderation einen Chat eröffnet hat.
  const beobachteSupport = useSupport((z) => z.beobachte)
  const eigeneAnfragen = useSupport((z) => z.eigene)
  const support = supportMenue(eigeneAnfragen)
  useEffect(() => {
    beobachteSupport(konto?.uid ?? null)
  }, [beobachteSupport, konto?.uid])

  /**
   * Angemeldet, aber ohne Profil: Ohne eigene Anzeige bliebe hier eine
   * Seite stehen, die auf etwas wartet, das nicht mehr kommt. Die
   * Moderationsansicht ist ausgenommen – sie hängt nicht am Profil.
   */
  const profilFehlt = Boolean(konto && !user && profilFehler) && !imModerationsbereich

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <NavLink to="/" className="flex items-center text-ink" aria-label="NØNE, zur Startseite">
            <Wortmarke className="h-5" />
          </NavLink>

          {konto ? (
            <nav aria-label="Hauptnavigation" className="flex items-center gap-1">
              <NavLink to="/chat" className={navClass}>
                Chat
              </NavLink>
              <NavLink to="/profil" className={navClass}>
                Profil
              </NavLink>
              <NavLink to="/preise" className={navClass}>
                Tarife
              </NavLink>
              {neuigkeitenLink}
              {support.sichtbar ? (
                <NavLink
                  to="/support"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-sm transition-colors ${
                      isActive || support.ungelesen
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-line-strong text-muted hover:border-accent hover:text-ink'
                    }`
                  }
                  aria-label={support.ungelesen ? 'Support – neue Antwort' : 'Support – laufender Chat'}
                >
                  Support
                  {support.ungelesen ? (
                    <span className="ruf-punkt inline-block h-2 w-2 rounded-full bg-signal" aria-hidden="true" />
                  ) : null}
                </NavLink>
              ) : null}
              {zeigtModeration ? (
                <NavLink to="/admin" className={modClass}>
                  <ShieldMark className="h-4 w-4 text-accent-strong" />
                  Moderation
                  {offen > 0 ? (
                    <span
                      // Schrift in Flächenfarbe: Auf dem Rot ist das hell im
                      // hellen und dunkel im dunklen Modus – beides über 5:1.
                      className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-signal px-1.5 py-0.5 text-[0.6875rem] leading-none font-semibold text-surface tabular-nums"
                      aria-label={`${offen} offene Vorgänge`}
                    >
                      {offen > 99 ? '99+' : offen}
                    </span>
                  ) : null}
                </NavLink>
              ) : null}
            </nav>
          ) : (
            <nav aria-label="Hauptnavigation" className="flex items-center gap-1">
              <NavLink to="/preise" className={navClass}>
                Tarife
              </NavLink>
              {neuigkeitenLink}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <span className="hidden font-mono text-xs text-muted sm:inline" title="Dein Anzeigename gegenüber anderen">
                {user.pseudonym}
              </span>
            ) : null}
            {konto ? <VerifiedBadge status={user?.verificationStatus ?? 'offen'} size="sm" /> : null}
            {konto ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-sm px-2 py-1 text-sm text-muted transition-colors hover:text-ink"
              >
                Abmelden
              </button>
            ) : (
              <NavLink to="/anmelden" className={navClass}>
                Anmelden
              </NavLink>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {!storageAvailable ? (
        <p className="border-b border-line bg-signal-soft px-4 py-2 text-center text-sm">
          Der lokale Speicher ist nicht verfügbar. Die App funktioniert, merkt sich aber nichts über einen Neuladen hinaus.
        </p>
      ) : null}

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {profilFehlt ? (
          <Profilfehler meldung={profilFehler ?? ''} />
        ) : (
          <Fehlergrenze schluessel={pathname}>
            <Outlet />
          </Fehlergrenze>
        )}
      </main>

      {/* Zwei einmalige Fenster nach der ersten Anmeldung, in dieser
          Reihenfolge: Erst die Pflichtangabe, dann das Tarifangebot. */}
      {konto && !ohneEinblendungen ? <GeschlechtDialog /> : null}
      {konto && !ohneEinblendungen ? <TarifDialog /> : null}

      <footer className="border-t border-line px-4 py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <p>NØNE · Verifizierter Zufallschat ab 18</p>
          <p className="font-mono" title={`Gebaut am ${new Date(__BUILD_ZEIT__).toLocaleString('de-CH')}`}>
            Version {__BUILD_ID__}
          </p>
          <nav aria-label="Weitere Seiten" className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
            {konto ? (
              <Link to="/support" className="underline underline-offset-2 hover:text-ink">
                Support
              </Link>
            ) : null}
            <Link to="/preise" className="underline underline-offset-2 hover:text-ink">
              Tarife
            </Link>
            <Link to="/neuigkeiten" className="underline underline-offset-2 hover:text-ink">
              Neuigkeiten
            </Link>
            <Link to="/impressum" className="underline underline-offset-2 hover:text-ink">
              Impressum
            </Link>
            <Link to="/datenschutz" className="underline underline-offset-2 hover:text-ink">
              Datenschutz
            </Link>
            <Link to="/agb" className="underline underline-offset-2 hover:text-ink">
              Nutzungsbedingungen
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
