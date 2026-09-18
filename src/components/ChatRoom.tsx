import { useState } from 'react'
import { Button, Panel } from './ui'
import { VerifiedBadge } from './VerifiedBadge'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { ReportDialog } from './ReportDialog'
import { languageLabelShort } from '../services/partnerScript'
import type { Partner, ReportReason, User } from '../services/types'
import { useChat } from '../store/useChat'

export function ChatRoom({ partner, user }: { partner: Partner; user: User }) {
  const messages = useChat((s) => s.messages)
  const typing = useChat((s) => s.partnerTyping)
  const sendMessage = useChat((s) => s.sendMessage)
  const endChat = useChat((s) => s.endChat)
  const nextChat = useChat((s) => s.nextChat)
  const report = useChat((s) => s.report)
  const error = useChat((s) => s.error)
  const clearError = useChat((s) => s.clearError)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)

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
              {languageLabelShort(partner.language)} · {partner.interests.join(', ')}
            </p>
          </div>
          <VerifiedBadge verified size="sm" />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void nextChat()}>
              Nächster Chat
            </Button>
            <Button size="sm" onClick={() => endChat('selbst')}>
              Chat beenden
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                clearError()
                setDialogOpen(true)
              }}
            >
              Melden
            </Button>
          </div>
        </header>

        <MessageList messages={messages} typing={typing} partnerPseudonym={partner.pseudonym} />
        <Composer onSend={sendMessage} />
      </Panel>

      <ReportDialog
        open={dialogOpen}
        onClose={() => {
          clearError()
          setDialogOpen(false)
        }}
        onSubmit={(reason, note) => void submitReport(reason, note)}
        partnerPseudonym={partner.pseudonym}
        excerptCount={Math.min(8, messages.filter((m) => m.author !== 'system').length)}
        busy={busy}
        error={error}
      />
    </>
  )
}
