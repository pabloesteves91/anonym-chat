import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'
import { ShieldMark, VerifiedBadge } from './VerifiedBadge'
import { ThemeToggle } from './ThemeToggle'
import { TarifDialog } from './TarifDialog'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-sm px-2.5 py-1.5 text-sm transition-colors ${
    isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink'
  }`

export function AppShell() {
  const konto = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)
  const user = useSession((s) => s.user)
  const storageAvailable = useSession((s) => s.storageAvailable)
  const { pathname } = useLocation()

  // Die Moderation ist kein Publikum: Dort hat ein Tarifangebot nichts
  // verloren, und ein Modal davor macht die Ansicht unbedienbar.
  const imModerationsbereich = pathname.startsWith('/admin')

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2 text-ink">
            <ShieldMark className="h-5 w-5 text-accent" />
            <span className="font-display text-lg leading-none font-semibold">Anonymchat</span>
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
            </nav>
          ) : (
            <nav aria-label="Hauptnavigation" className="flex items-center gap-1">
              <NavLink to="/preise" className={navClass}>
                Tarife
              </NavLink>
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
        <Outlet />
      </main>

      {/* Einmalige Tarifwahl nach der ersten Anmeldung. */}
      {konto && !imModerationsbereich ? <TarifDialog /> : null}

      <footer className="border-t border-line px-4 py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <p>Anonymchat · Verifizierter Zufallschat ab 18</p>
          <nav aria-label="Rechtliches" className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/preise" className="underline underline-offset-2 hover:text-ink">
              Tarife
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
