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
          ? 'Danke – die Moderation übernimmt'
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
            Vorgangsnummer <span className="font-mono">{report.id}</span>. Mitgeschickt wurden {report.excerpt.length}{' '}
            Nachrichten. Die Moderation sieht sie sich an und entscheidet über eine Sperre.
          </Note>
        </div>
      ) : blockiert ? (
        <p className="mt-2 max-w-prose text-muted">
          Das Konto ist nur für dich blockiert – die Moderation erfährt davon nichts. Wenn etwas vorgefallen ist, das
          Konsequenzen haben sollte, ist eine Meldung der richtige Weg. Aufheben lässt sich die Blockierung im Profil.
        </p>
      ) : (
        <p className="mt-2 max-w-prose text-muted">
          Für dich ist der Verlauf weg – nachlesen kann ihn weder du noch dein Gegenüber. Die Moderation kann ihn bei
          Verdacht auf Missbrauch noch 72 Stunden lang einsehen, danach wird er automatisch gelöscht. Jeder solche
          Zugriff wird protokolliert.
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
            Gesprächspartner sind zufällig. Sichtbar ist beidseitig nur der Anzeigename – und dass die Gegenseite die
            Verifizierung durchlaufen hat.
          </p>
        </div>
      ) : null}

      {grenzeErreicht ? (
        <Panel className="p-5">
          <p className="label-caps">Tagesgrenze erreicht</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Für heute ist das Gratiskontingent aufgebraucht</h2>
          <p className="mt-2 max-w-prose text-muted">
            Morgen geht es von selbst weiter. Wer nicht warten will, hebt die Grenze mit Plus auf – am Dienst selbst
            ändert das nichts, nur an der Anzahl.
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
