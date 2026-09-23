import { useState } from 'react'
import { Button, Panel } from './ui'
import { VerifiedBadge } from './VerifiedBadge'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { ReportDialog } from './ReportDialog'
import { Sicherheitsmenue } from './Sicherheitsmenue'
import { Vorschlaege } from './Vorschlaege'
import type { FilterCategory, Message, Partner, ReportReason, User } from '../services/types'

/** Aus einem Filtertreffer den passenden Meldegrund ableiten. */
const GRUND_ZU: Record<FilterCategory, ReportReason> = {
  sexuell: 'sexuell',
  minderjaehrig: 'minderjaehrig',
  drohung: 'belaestigung',
  beleidigung: 'belaestigung',
  spam: 'spam',
}
import { useChat } from '../store/useChat'

export function ChatRoom({ partner, user }: { partner: Partner; user: User }) {
  const messages = useChat((s) => s.messages)
  const typing = useChat((s) => s.partnerTyping)
  const partnerOnline = useChat((s) => s.partnerOnline)
  const notifyTyping = useChat((s) => s.notifyTyping)
  const sendMessage = useChat((s) => s.sendMessage)
  const endChat = useChat((s) => s.endChat)
  const nextChat = useChat((s) => s.nextChat)
  const blockAndEnd = useChat((s) => s.blockAndEnd)
  const report = useChat((s) => s.report)
  const error = useChat((s) => s.error)
  const clearError = useChat((s) => s.clearError)
  const entwurf = useChat((s) => s.entwurf)
  const testModus = useChat((s) => s.testModus)
  const setEntwurf = useChat((s) => s.setEntwurf)
  const vorschlagEinfuegen = useChat((s) => s.vorschlagEinfuegen)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [menueOffen, setMenueOffen] = useState(false)
  const [vorschlaegeOffen, setVorschlaegeOffen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [grund, setGrund] = useState<ReportReason>('belaestigung')

  const meldeNachricht = (message: Message) => {
    if (message.flag) setGrund(GRUND_ZU[message.flag.category])
    clearError()
    setDialogOpen(true)
  }

  const melden = () => {
    setMenueOffen(false)
    clearError()
    setDialogOpen(true)
  }

  const submitReport = async (reason: ReportReason, note: string) => {
    setBusy(true)
    const result = await report(reason, note, user)
    setBusy(false)
    // Nur schliessen, wenn die Meldung wirklich erfasst wurde – sonst bleibt
    // der Dialog mit Fehlermeldung offen und der Text erhalten.
    if (result) setDialogOpen(false)
  }

  return (
    <>
      <Panel className="flex h-[calc(100dvh-14rem)] max-h-[42rem] min-h-[26rem] flex-col overflow-hidden">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
          <div>
            <p className="font-mono text-ink">{partner.pseudonym}</p>
            <p className="text-xs text-muted">
              {partnerOnline ? 'anwesend' : 'gerade nicht am Gerät'}
            </p>
          </div>
          {testModus ? (
            <span className="rounded-sm border border-signal/50 bg-signal-soft px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-signal uppercase">
              Test · kein Mensch
            </span>
          ) : (
            <VerifiedBadge status="verifiziert" size="sm" />
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" title="Beendet diesen Chat und sucht sofort mit denselben Filtern weiter" onClick={() => void nextChat()}>
              Nächste Person
            </Button>
            <Button size="sm" aria-haspopup="dialog" onClick={() => setMenueOffen(true)}>
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 1.5 2.5 3.5v4c0 3.2 2.3 5.9 5.5 7 3.2-1.1 5.5-3.8 5.5-7v-4L8 1.5Z" strokeLinejoin="round" />
              </svg>
              Sicherheit
            </Button>
          </div>
        </header>

        <MessageList
          messages={messages}
          typing={typing}
          partnerPseudonym={partner.pseudonym}
          onReport={meldeNachricht}
        />
        {vorschlaegeOffen ? (
          <Vorschlaege
            onWaehlen={(text) => {
              vorschlagEinfuegen(text)
              setVorschlaegeOffen(false)
              document.getElementById('nachricht')?.focus()
            }}
            onSchliessen={() => setVorschlaegeOffen(false)}
          />
        ) : (
          <div className="flex px-4 py-1.5">
            <button
              type="button"
              onClick={() => setVorschlaegeOffen(true)}
              className="rounded-sm px-1 py-0.5 text-sm font-medium text-accent-strong underline-offset-4 hover:underline"
            >
              ✦ NØNE Vorschläge
            </button>
          </div>
        )}
        <Composer value={entwurf} onChange={setEntwurf} onSend={(text) => void sendMessage(text)} onTyping={notifyTyping} />
      </Panel>

      <Sicherheitsmenue
        open={menueOffen}
        onClose={() => setMenueOffen(false)}
        partnerPseudonym={partner.pseudonym}
        onVerlassen={() => {
          setMenueOffen(false)
          endChat('selbst')
        }}
        onNichtMehrVerbinden={() => {
          setMenueOffen(false)
          void blockAndEnd()
        }}
        onMelden={melden}
      />

      <ReportDialog
        open={dialogOpen}
        onClose={() => {
          clearError()
          setDialogOpen(false)
        }}
        onSubmit={(reason, note) => void submitReport(reason, note)}
        partnerPseudonym={partner.pseudonym}
        defaultReason={grund}
        excerptCount={Math.min(8, messages.filter((m) => m.author !== 'system').length)}
        busy={busy}
        error={error}
      />
    </>
  )
}
