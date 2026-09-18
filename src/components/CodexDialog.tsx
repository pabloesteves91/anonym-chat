import { Dialog } from './Dialog'
import { Button } from './ui'

const REGELN = [
  {
    titel: 'Das Gegenüber ist eine echte, geprüfte Person',
    text: 'Anonymität gilt nach aussen, nicht nach innen. Was du schreibst, ist deinem Konto zugeordnet.',
  },
  {
    titel: 'Keine sexuelle Ansprache ohne Einverständnis',
    text: 'Aufforderungen zu Bildern, sexuelle Inhalte und Belästigung führen zur Sperre – nicht zur Verwarnung.',
  },
  {
    titel: 'Keine Kontaktdaten, keine Weiterleitung',
    text: 'Telefonnummern, Profile auf anderen Plattformen und Links gehören nicht in den Chat.',
  },
  {
    titel: 'Melden statt aushalten',
    text: 'Eine Meldung beendet den Chat sofort und ihr werdet nicht mehr verbunden.',
  },
]

/** Einmalige Bestätigung vor dem ersten Chat. */
export function CodexDialog({
  open,
  onClose,
  onAccept,
  busy,
}: {
  open: boolean
  onClose: () => void
  onAccept: () => void
  busy: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Bevor es losgeht"
      description="Vier Punkte, einmalig zu bestätigen. Sie gelten für alle Chats."
    >
      <ol className="flex flex-col gap-3">
        {REGELN.map((regel, index) => (
          <li key={regel.titel} className="flex gap-3">
            <span className="mt-0.5 font-mono text-xs text-accent">{String(index + 1).padStart(2, '0')}</span>
            <span>
              <span className="block font-medium">{regel.titel}</span>
              <span className="block text-sm text-muted">{regel.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="quiet" onClick={onClose} disabled={busy}>
          Abbrechen
        </Button>
        <Button variant="primary" onClick={onAccept} disabled={busy}>
          Verstanden, Chat starten
        </Button>
      </div>
    </Dialog>
  )
}
