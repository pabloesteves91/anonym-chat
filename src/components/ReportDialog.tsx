import { useState } from 'react'
import { Dialog } from './Dialog'
import { Button, Note, inputClass } from './ui'
import { REPORT_REASONS } from '../services/types'
import type { ReportReason } from '../services/types'

export function ReportDialog({
  open,
  onClose,
  onSubmit,
  partnerPseudonym,
  excerptCount,
  busy,
  error,
  defaultReason = 'belaestigung',
}: {
  open: boolean
  onClose: () => void
  onSubmit: (reason: ReportReason, note: string) => void
  partnerPseudonym: string
  excerptCount: number
  busy: boolean
  error?: string | null
  defaultReason?: ReportReason
}) {
  const [reason, setReason] = useState<ReportReason>(defaultReason)
  const [note, setNote] = useState('')
  const [zuletzt, setZuletzt] = useState(defaultReason)

  // Kommt die Meldung aus einer markierten Nachricht, passt der Grund schon.
  if (defaultReason !== zuletzt) {
    setZuletzt(defaultReason)
    setReason(defaultReason)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${partnerPseudonym} melden`}
      description="Die Meldung geht an die Moderation. Der Chat wird dabei sofort beendet."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(reason, note)
        }}
      >
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="label-caps mb-1">Grund</legend>
          {REPORT_REASONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-sm border px-3 py-2 transition-colors ${
                reason === option.value ? 'border-accent bg-accent-soft' : 'border-line hover:bg-raised'
              }`}
            >
              <input
                type="radio"
                name="grund"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="block text-sm text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="meldung-notiz" className="label-caps">
            Was ist passiert? (optional)
          </label>
          <textarea
            id="meldung-notiz"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={`${inputClass} resize-y`}
            placeholder="Ein paar Worte helfen der Moderation, das einzuordnen."
          />
        </div>

        <Note>
          Die letzten {excerptCount} Nachrichten gehen mit der Meldung mit. Der ganze Chat wird ohnehin 72 Stunden
          aufbewahrt. Mit deiner Meldung sieht ihn sich jemand an.
        </Note>

        {error ? <Note tone="warn">{error}</Note> : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? 'Wird gesendet …' : 'Melden und Chat beenden'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
