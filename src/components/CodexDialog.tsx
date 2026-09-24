import { Dialog } from './Dialog'
import { Button } from './ui'

const REGELN = [
  {
    titel: 'Dein Gegenüber ist ein echter, verifizierter Mensch',
    text: 'Anonym heisst: Andere wissen nicht, wer du bist. Was du schreibst, ist trotzdem deinem Konto zugeordnet und wird 72 Stunden für die Missbrauchsprüfung aufbewahrt.',
  },
  {
    titel: 'Keine sexuelle Ansprache ohne Zustimmung',
    text: 'Aufforderungen zu Bildern, sexuelle Inhalte und Belästigung führen zur Sperre, nicht bloss zu einer Verwarnung.',
  },
  {
    titel: 'Keine Kontaktdaten, keine Weiterleitung',
    text: 'Telefonnummern, Profile auf anderen Plattformen und Links gehören nicht in den Chat.',
  },
  {
    titel: 'Melden statt aushalten',
    text: 'Eine Meldung beendet den Chat sofort, und ihr werdet nicht mehr verbunden.',
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
      description="Vier Regeln. Du bestätigst sie einmal, dann gelten sie für alle Chats."
    >
      <ol className="flex flex-col gap-3">
        {REGELN.map((regel, index) => (
          <li key={regel.titel} className="flex gap-3">
            <span className="mt-0.5 font-mono text-xs text-accent-strong">{String(index + 1).padStart(2, '0')}</span>
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
