import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Landing } from './routes/Landing'
import { Verify } from './routes/Verify'
import { Profile } from './routes/Profile'
import { Chat } from './routes/Chat'
import { Admin } from './routes/Admin'
import { NotFound } from './routes/NotFound'
import { useSession } from './store/useSession'
import { useAdminAccess } from './store/useAdminAccess'
import type { ReactElement } from 'react'

/** Schützt Routen, die eine abgeschlossene Verifizierung voraussetzen. */
function RequireVerified({ children }: { children: ReactElement }) {
  const ready = useSession((s) => s.ready)
  const user = useSession((s) => s.user)
  const location = useLocation()

  if (!ready) return <LoadingScreen />
  if (!user?.verified) return <Navigate to="/verifizierung" replace state={{ from: location.pathname }} />
  return children
}

/**
 * Schützt die Moderationsansicht. Heute lässt sie alle durch – die
 * Entscheidung darüber fällt in services/auth.ts, nicht hier.
 */
function RequireModerator({ children }: { children: ReactElement }) {
  const geprueft = useAdminAccess((s) => s.geprueft)
  const erlaubt = useAdminAccess((s) => s.erlaubt)
  const check = useAdminAccess((s) => s.check)

  useEffect(() => {
    void check()
  }, [check])

  if (!geprueft) return <LoadingScreen />
  if (!erlaubt) {
    return (
      <div className="prose-column">
        <p className="label-caps">Kein Zugang</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Diese Ansicht ist der Moderation vorbehalten</h1>
        <p className="mt-3 text-muted">
          Melde dich mit einem berechtigten Konto an, um Verifizierungen, Chatverläufe und Meldungen zu sehen.
        </p>
      </div>
    )
  }
  return children
}

function LoadingScreen() {
  return (
    <p className="label-caps" role="status">
      Sitzung wird geladen …
    </p>
  )
}

export default function App() {
  const load = useSession((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Landing />} />
        <Route path="verifizierung" element={<Verify />} />
        <Route
          path="profil"
          element={
            <RequireVerified>
              <Profile />
            </RequireVerified>
          }
        />
        <Route
          path="chat"
          element={
            <RequireVerified>
              <Chat />
            </RequireVerified>
          }
        />
        <Route
          path="admin"
          element={
            <RequireModerator>
              <Admin />
            </RequireModerator>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
