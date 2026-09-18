import { NavLink, Outlet } from 'react-router-dom'
import { useSession } from '../store/useSession'
import { ShieldMark, VerifiedBadge } from './VerifiedBadge'
import { ThemeToggle } from './ThemeToggle'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-sm px-2.5 py-1.5 text-sm transition-colors ${
    isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink'
  }`

export function AppShell() {
  const user = useSession((s) => s.user)
  const storageAvailable = useSession((s) => s.storageAvailable)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2 text-ink">
            <ShieldMark className="h-5 w-5 text-accent" />
            <span className="font-display text-lg leading-none font-semibold">Anonymchat</span>
          </NavLink>

          <nav aria-label="Hauptnavigation" className="flex items-center gap-1">
            <NavLink to="/chat" className={navClass}>
              Chat
            </NavLink>
            <NavLink to="/profil" className={navClass}>
              Profil
            </NavLink>
            <NavLink to="/admin" className={navClass}>
              Meldungen
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <span className="hidden font-mono text-xs text-muted sm:inline" title="Dein Anzeigename gegenüber anderen">
                {user.pseudonym}
              </span>
            ) : null}
            <VerifiedBadge status={user?.verificationStatus ?? 'offen'} size="sm" />
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

      <footer className="border-t border-line px-4 py-4">
        <p className="mx-auto max-w-5xl text-xs text-muted">
          Prototyp, Phase 1. Simulierte SMS, manuelle Freigabe in der eigenen Moderationsansicht, simulierte
          Gesprächspartner, keine Serververbindung. Ausweisbilder bleiben im Sitzungsspeicher dieses Browsers.
        </p>
      </footer>
    </div>
  )
}
