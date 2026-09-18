import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button, Note, PageTitle, Panel } from '../components/ui'
import { Lobby } from '../components/Lobby'
import { Queue } from '../components/Queue'
import { ChatRoom } from '../components/ChatRoom'
import { REPORT_REASONS } from '../services/types'
import { useChat } from '../store/useChat'
import { useSession } from '../store/useSession'

function Ended() {
  const endReason = useChat((s) => s.endReason)
  const report = useChat((s) => s.lastReport)
  const dismiss = useChat((s) => s.dismissEnded)
  const startSearch = useChat((s) => s.startSearch)

  const gemeldet = endReason === 'gemeldet'
  const blockiert = endReason === 'blockiert'
  const reasonLabel = REPORT_REASONS.find((r) => r.value === report?.reason)?.label

  return (
    <Panel className="p-6">
      <p className="label-caps">
        {gemeldet ? 'Meldung erfasst' : blockiert ? 'Konto blockiert' : 'Chat beendet'}
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold">
        {gemeldet
          ? 'Danke – die Moderation übernimmt'
          : blockiert
            ? 'Ihr werdet nicht mehr verbunden'
            : 'Der Verlauf wurde verworfen'}
      </h2>

      {gemeldet && report ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-muted">
            Gemeldet: <span className="font-mono text-ink">{report.reportedPseudonym}</span>
            {reasonLabel ? ` · ${reasonLabel}` : null}
          </p>
          <Note>
            Vorgangsnummer <span className="font-mono">{report.id}</span>. Mitgeschickt wurden {report.excerpt.length}{' '}
            Nachrichten. Im Prototyp landet die Meldung in der{' '}
            <Link to="/admin" className="text-accent underline underline-offset-2">
              Moderationsansicht
            </Link>
            .
          </Note>
        </div>
      ) : blockiert ? (
        <p className="mt-2 max-w-prose text-muted">
          Das Konto ist nur für dich blockiert – die Moderation erfährt davon nichts. Wenn etwas vorgefallen ist, das
          Konsequenzen haben sollte, ist eine Meldung der richtige Weg. Aufheben lässt sich die Blockierung im Profil.
        </p>
      ) : (
        <p className="mt-2 max-w-prose text-muted">
          Nachrichten dieses Chats sind gelöscht und lassen sich nicht wiederherstellen – auch nicht von uns. Das ist
          Absicht.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => void startSearch()}>
          Neuen Chat starten
        </Button>
        <Button onClick={dismiss}>Zurück zur Auswahl</Button>
      </div>
    </Panel>
  )
}

export function Chat() {
  const user = useSession((s) => s.user)
  const status = useChat((s) => s.status)
  const partner = useChat((s) => s.partner)
  const filter = useChat((s) => s.filter)
  const setFilter = useChat((s) => s.setFilter)
  const prefilled = useRef(false)

  // Sprache einmalig aus dem Profil vorbelegen – Interessen bleiben offen,
  // damit die Suche nicht unnötig eng startet.
  useEffect(() => {
    if (prefilled.current || !user) return
    prefilled.current = true
    if (filter.language === 'egal' && filter.interests.length === 0) {
      setFilter({ ...filter, language: user.profile.language })
    }
  }, [user, filter, setFilter])

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      {status !== 'aktiv' ? (
        <div className="prose-column">
          <PageTitle kicker="Beide Seiten verifiziert">Chat</PageTitle>
          <p className="text-muted">
            Gesprächspartner sind zufällig. Sichtbar ist beidseitig nur der Anzeigename – und dass die Gegenseite die
            Verifizierung durchlaufen hat.
          </p>
        </div>
      ) : null}

      {status === 'idle' ? <Lobby /> : null}
      {status === 'suche' ? <Queue /> : null}
      {status === 'aktiv' && partner ? <ChatRoom partner={partner} user={user} /> : null}
      {status === 'beendet' ? <Ended /> : null}
    </div>
  )
}
