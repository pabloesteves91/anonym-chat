import { useState } from 'react'
import { FEEDBACK_WERTE } from '../services/feedback'
import { useChat } from '../store/useChat'

/**
 * „Wie war das Gespräch?" – nach dem Ende, freiwillig, ein Tipp.
 *
 * Das Gegenüber erfährt nie davon; es gibt keine Punkte und keine Sterne.
 * Einmal pro Gespräch: Danach steht nur noch der Dank da.
 */
export function GespraechsFeedback({ kompakt = false }: { kompakt?: boolean }) {
  const letzter = useChat((s) => s.letzterChat)
  const gibFeedback = useChat((s) => s.gibFeedback)
  const ueberspringen = useChat((s) => s.feedbackUeberspringen)
  const [fehler, setFehler] = useState(false)

  if (!letzter) return null
  if (letzter.feedback === 'gesendet') {
    return (
      <p role="status" className={`text-sm text-muted ${kompakt ? '' : 'mt-5'}`}>
        Danke für dein Feedback.
      </p>
    )
  }
  if (letzter.feedback !== 'offen') return null

  return (
    <div className={`rounded-sm border border-line bg-raised p-4 ${kompakt ? 'text-left' : 'mt-5'}`}>
      <p className="font-medium">{kompakt ? 'Wie war dein letztes Gespräch?' : 'Wie war das Gespräch?'}</p>
      <p className="mt-0.5 text-sm text-muted">Freiwillig. Dein Gegenüber erfährt nichts davon.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FEEDBACK_WERTE.map((option) => (
          <button
            key={option.wert}
            type="button"
            onClick={() => {
              setFehler(false)
              void gibFeedback(option.wert).then((ok) => setFehler(!ok))
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 py-2 text-sm font-medium transition-colors hover:border-accent"
          >
            <span aria-hidden="true">{option.zeichen}</span>
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={ueberspringen}
          className="min-h-11 rounded-sm px-3 py-2 text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          Überspringen
        </button>
      </div>
      {fehler ? (
        <p role="alert" className="mt-2 text-sm text-signal">
          Das hat nicht geklappt. Du kannst es noch einmal versuchen oder überspringen.
        </p>
      ) : null}
    </div>
  )
}
