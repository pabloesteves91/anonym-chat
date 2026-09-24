import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button, Note, PageTitle, Panel } from '../components/ui'
import { buttonClass } from '../components/buttonClass'
import { Lobby } from '../components/Lobby'
import { Queue } from '../components/Queue'
import { ChatRoom } from '../components/ChatRoom'
import { GespraechsFeedback } from '../components/GespraechsFeedback'
import { REPORT_REASONS } from '../services/types'
import { useChat } from '../store/useChat'
import { useSession } from '../store/useSession'

function Ended() {
  const endReason = useChat((s) => s.endReason)
  const report = useChat((s) => s.lastReport)
  const dismiss = useChat((s) => s.dismissEnded)
  const startSearch = useChat((s) => s.startSearch)
  const testModus = useChat((s) => s.testModus)

  const gemeldet = endReason === 'gemeldet'
  const blockiert = endReason === 'blockiert'
  const vomPartner = endReason === 'partner'
  const reasonLabel = REPORT_REASONS.find((r) => r.value === report?.reason)?.label

  return (
    <Panel className="p-6">
      <p className="label-caps">
        {gemeldet ? 'Meldung erfasst' : blockiert ? 'Konto blockiert' : vomPartner ? 'Verlassen' : 'Chat beendet'}
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold">
        {gemeldet
          ? 'Danke. Die Moderation kümmert sich darum.'
          : blockiert
            ? 'Ihr werdet nicht mehr verbunden'
            : vomPartner
              ? 'Dein Gegenüber hat den Chat beendet'
              : 'Der Chat ist vorbei'}
      </h2>

      {gemeldet && report ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-muted">
            Gemeldet: <span className="font-mono text-ink">{report.reportedPseudonym}</span>
            {reasonLabel ? ` · ${reasonLabel}` : null}
          </p>
          <Note>
            Vorgangsnummer <span className="font-mono">{report.id}</span>. Mit der Meldung gingen {report.excerpt.length}{' '}
            Nachrichten an die Moderation. Sie sieht sie sich an und entscheidet, ob das Konto gesperrt wird.
          </Note>
        </div>
      ) : blockiert ? (
        <p className="mt-2 max-w-prose text-muted">
          Das Konto ist nur für dich blockiert. Die Moderation erfährt davon nichts. Ist etwas vorgefallen, das
          Folgen haben sollte, melde es. Die Blockierung kannst du im Profil wieder aufheben.
        </p>
      ) : (
        <p className="mt-2 max-w-prose text-muted">
          Der Chat ist weg. Weder du noch dein Gegenüber kann ihn nochmals lesen. Bei Verdacht auf Missbrauch kann
          die Moderation ihn noch 72 Stunden lang einsehen, danach wird er automatisch gelöscht. Jeder Zugriff wird
          protokolliert.
        </p>
      )}

      {testModus ? (
        <Note tone="warn">
          Das war ein Testgespräch. Nichts davon wurde gespeichert, gezählt oder an die Moderation gemeldet.
          „Nächste Person" startet ein weiteres Testgespräch.
        </Note>
      ) : null}

      <GespraechsFeedback />

      {/* „Nächste Person" startet einen neuen Chat mit denselben Filtern –
          Tagesgrenze und Vorrang wie bei jeder Suche. */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => void startSearch()}>
          Nächste Person
        </Button>
        <Button onClick={dismiss}>Zurück zur Auswahl</Button>
      </div>
      <p className="mt-2 text-xs text-muted">„Nächste Person" sucht sofort weiter, mit denselben Filtern.</p>
    </Panel>
  )
}

export function Chat() {
  const user = useSession((s) => s.user)
  const status = useChat((s) => s.status)
  const partner = useChat((s) => s.partner)
  const grenzeErreicht = useChat((s) => s.grenzeErreicht)
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
            Wen du triffst, ist Zufall. Ihr seht voneinander nur den Anzeigenamen und dass ihr beide verifiziert
            seid.
          </p>
        </div>
      ) : null}

      {grenzeErreicht ? (
        <Panel className="p-5">
          <p className="label-caps">Tageslimit erreicht</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Deine Gratis-Chats für heute sind aufgebraucht</h2>
          <p className="mt-2 max-w-prose text-muted">
            Morgen kannst du wieder chatten. Mit Plus fällt das Limit weg. Sonst ändert sich nichts.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/preise" className={buttonClass('primary')}>
              Tarife ansehen
            </Link>
          </div>
        </Panel>
      ) : null}

      {status === 'idle' && !grenzeErreicht ? <Lobby /> : null}
      {status === 'suche' ? <Queue /> : null}
      {status === 'aktiv' && partner ? <ChatRoom partner={partner} user={user} /> : null}
      {status === 'beendet' ? <Ended /> : null}
    </div>
  )
}
