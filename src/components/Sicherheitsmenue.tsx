import { Dialog } from './Dialog'

interface Wahl {
  titel: string
  text: string
  onClick: () => void
  gefahr?: boolean
}

/**
 * Das Sicherheitsmenü im laufenden Chat.
 *
 * Drei Wege hinaus, jeder mit einem Satz dazu, was er bewirkt. Ruhig
 * gestaltet: Wer hier landet, soll schnell entscheiden können, ohne dass
 * es nach Alarm aussieht. Die Flächen sind gross genug für den Daumen.
 */
export function Sicherheitsmenue({
  open,
  onClose,
  partnerPseudonym,
  onVerlassen,
  onNichtMehrVerbinden,
  onMelden,
}: {
  open: boolean
  onClose: () => void
  partnerPseudonym: string
  onVerlassen: () => void
  onNichtMehrVerbinden: () => void
  onMelden: () => void
}) {
  const wahlen: Wahl[] = [
    {
      titel: 'Chat verlassen',
      text: 'Beendet das Gespräch. Ihr könnt später wieder zufällig verbunden werden.',
      onClick: onVerlassen,
    },
    {
      titel: 'Nicht mehr verbinden',
      text: 'Beendet das Gespräch, und ihr werdet nie wieder miteinander verbunden. Die Moderation erfährt davon nichts.',
      onClick: onNichtMehrVerbinden,
    },
    {
      titel: 'Melden & verlassen',
      text: 'Die Moderation sieht sich das Gespräch an. Der Chat endet sofort, und ihr werdet nicht mehr verbunden.',
      onClick: onMelden,
      gefahr: true,
    },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sicherheit"
      description={`Du entscheidest, wie es mit ${partnerPseudonym} weitergeht. Dein Gegenüber sieht nur, dass der Chat beendet wurde.`}
    >
      <ul className="flex flex-col gap-2">
        {wahlen.map((wahl) => (
          <li key={wahl.titel}>
            <button
              type="button"
              onClick={wahl.onClick}
              className={`flex w-full flex-col gap-0.5 rounded-sm border px-4 py-3 text-left transition-colors ${
                wahl.gefahr ? 'border-signal/50 hover:bg-signal-soft' : 'border-line-strong hover:bg-raised'
              }`}
            >
              <span className={`font-medium ${wahl.gefahr ? 'text-signal' : 'text-ink'}`}>{wahl.titel}</span>
              <span className="text-sm text-muted">{wahl.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm px-3 py-2 text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          Zurück zum Chat
        </button>
      </div>
    </Dialog>
  )
}
