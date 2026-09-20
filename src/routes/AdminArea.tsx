import { useEffect } from 'react'
import { Admin } from './Admin'
import { ModeratorLogin } from '../components/ModeratorLogin'
import { useAdminAccess } from '../store/useAdminAccess'

/**
 * Moderationsbereich, inklusive Zugangsprüfung.
 *
 * Eigene Datei, damit sie nachgeladen werden kann: Nur wer hierher kommt,
 * lädt Firebase – für den Chat wird es nicht gebraucht.
 */
export default function AdminArea() {
  const geprueft = useAdminAccess((s) => s.geprueft)
  const erlaubt = useAdminAccess((s) => s.erlaubt)
  const watch = useAdminAccess((s) => s.watch)

  useEffect(() => watch(), [watch])

  if (!geprueft) {
    return (
      <p className="label-caps" role="status">
        Zugang wird geprüft …
      </p>
    )
  }
  if (!erlaubt) return <ModeratorLogin />
  return <Admin />
}
