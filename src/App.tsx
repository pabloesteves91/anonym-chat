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
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
