import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Landing } from './routes/Landing'
import { Login } from './routes/Login'
import { Verify } from './routes/Verify'
import { Profile } from './routes/Profile'
import { Chat } from './routes/Chat'
import { Preise } from './routes/Preise'
import { Datenschutz, Impressum, Nutzungsbedingungen } from './routes/Legal'
import { NotFound } from './routes/NotFound'
import { useAuth } from './store/useAuth'
import { useSession } from './store/useSession'
import type { ReactElement } from 'react'

// Nachladen statt mitliefern: der Moderationsbereich bringt Firebase mit.
const AdminArea = lazy(() => import('./routes/AdminArea'))

function LoadingScreen() {
  return (
    <p className="label-caps" role="status">
      Einen Moment …
    </p>
  )
}

/** Setzt ein angemeldetes Konto voraus. */
function RequireUser({ children }: { children: ReactElement }) {
  const ready = useAuth((s) => s.ready)
  const user = useAuth((s) => s.user)
  const location = useLocation()

  if (!ready) return <LoadingScreen />
  if (!user) return <Navigate to="/anmelden" replace state={{ from: location.pathname }} />
  return children
}

/** Setzt zusätzlich eine abgeschlossene Verifizierung voraus. */
function RequireVerified({ children }: { children: ReactElement }) {
  const ready = useSession((s) => s.ready)
  const loading = useSession((s) => s.loading)
  const user = useSession((s) => s.user)

  if (!ready || loading) return <LoadingScreen />
  if (!user?.verified) return <Navigate to="/verifizierung" replace />
  return children
}

export default function App() {
  useEffect(
    () =>
      // Eine Anmeldung schaltet den Speicherbereich um; danach wird das
      // Profil dieses Kontos geladen.
      useAuth.getState().watch((uid) => {
        if (uid) {
          // Scheitert das Laden, muss es sichtbar sein – sonst hängt die App
          // stumm im Ladezustand.
          void useSession
            .getState()
            .load(uid)
            .catch((error: unknown) => console.error('Profil konnte nicht geladen werden:', error))
        } else {
          useSession.getState().clear()
        }
      }),
    [],
  )

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Landing />} />
        <Route path="anmelden" element={<Login />} />
        <Route path="preise" element={<Preise />} />
        <Route path="impressum" element={<Impressum />} />
        <Route path="datenschutz" element={<Datenschutz />} />
        <Route path="agb" element={<Nutzungsbedingungen />} />
        <Route
          path="verifizierung"
          element={
            <RequireUser>
              <Verify />
            </RequireUser>
          }
        />
        <Route
          path="profil"
          element={
            <RequireUser>
              <RequireVerified>
                <Profile />
              </RequireVerified>
            </RequireUser>
          }
        />
        <Route
          path="chat"
          element={
            <RequireUser>
              <RequireVerified>
                <Chat />
              </RequireVerified>
            </RequireUser>
          }
        />
        <Route
          path="admin"
          element={
            <Suspense fallback={<LoadingScreen />}>
              <AdminArea />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
