import { useState, type KeyboardEvent } from 'react'
import { Button } from './ui'
import { scanText } from '../services/wordFilter'
import type { FilterCategory } from '../services/types'

/** Was bei einem schweren Treffer auf dem Spiel steht – je nach Art. */
const WARNUNG: Record<FilterCategory, { titel: string; text: string }> = {
  sexuell: {
    titel: 'Sexuelle Ansprache',
    text: 'Sexuelle Nachrichten ohne klare Zustimmung sind hier nicht erlaubt. Das führt zur Sperre, nicht bloss zu einer Verwarnung.',
  },
  minderjaehrig: {
    titel: 'Hinweis auf eine minderjährige Person',
    text: 'NØNE ist erst ab 18. Sexuelle Ansprache von Minderjährigen ist strafbar. Wir erstatten Anzeige.',
  },
  drohung: {
    titel: 'Drohung',
    text: 'Drohungen führen sofort zur dauerhaften Sperre und können strafbar sein.',
  },
  beleidigung: {
    titel: 'Beleidigung',
    text: 'Beschimpfungen werden oft gemeldet. Wer das wiederholt, wird gesperrt.',
  },
  spam: {
    titel: 'Kontaktdaten oder Weiterleitung',
    text: 'Ausserhalb von NØNE gilt keine Verifizierung mehr, und wir können dir dort nicht helfen.',
  },
}

/**
 * Eingabezeile. Der Wortfilter läuft schon beim Tippen und warnt vorab –
 * gesendet wird trotzdem, markiert wird hinterher.
 *
 * Der Text gehört dem Aufrufer (`value`/`onChange`): So kann ein
 * Gesprächsstarter ihn füllen, ohne ihn zu senden. Gesendet wird nur hier,
 * mit Enter oder dem Knopf.
 */
export function Composer({
  value: text,
  onChange: setText,
  onSend,
  onTyping,
  disabled,
}: {
  value: string
  onChange: (text: string) => void
  onSend: (text: string) => void
  /** Meldet, dass gerade geschrieben wird – gedrosselt vom Aufrufer. */
  onTyping?: () => void
  disabled?: boolean
}) {
  const [confirmed, setConfirmed] = useState(false)
  const verdict = text.trim().length > 2 ? scanText(text) : null
  // Schwere Treffer brauchen einen zweiten, bewussten Klick.
  const needsConfirm = verdict?.level === 'severe' && !confirmed

  const submit = () => {
    const value = text.trim()
    if (!value || disabled) return
    if (needsConfirm) {
      setConfirmed(true)
      return
    }
    onSend(value)
    setText('')
    setConfirmed(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-line px-4 py-3">
      {verdict?.level === 'severe' ? (
        <div
          role="alert"
          className="mb-3 rounded-sm border border-signal/50 bg-signal-soft px-3 py-2.5 text-sm"
        >
          <p className="font-mono text-[0.6875rem] tracking-wide text-signal uppercase">
            ▲ {WARNUNG[verdict.category].titel}
          </p>
          <p className="mt-1">{WARNUNG[verdict.category].text}</p>
          <p className="mt-1 text-muted">
            Die Moderation kann den Chat 72 Stunden lang einsehen. Wenn du trotzdem sendest, tust du das auf eigene
            Verantwortung.
          </p>
        </div>
      ) : verdict ? (
        <p className="mb-2 font-mono text-[0.6875rem] tracking-wide text-signal uppercase" aria-live="polite">
          Hinweis: {verdict.reason}. Sendest du sie, wird die Nachricht markiert.
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor="nachricht" className="sr-only">
          Nachricht
        </label>
        <textarea
          id="nachricht"
          rows={1}
          maxLength={2000}
          value={text}
          disabled={disabled}
          onChange={(event) => {
            setText(event.target.value)
            setConfirmed(false)
            if (event.target.value.trim()) onTyping?.()
          }}
          onKeyDown={onKeyDown}
          placeholder="Nachricht schreiben. Enter sendet, Shift+Enter macht eine neue Zeile."
          className="max-h-32 min-h-[2.75rem] flex-1 resize-y rounded-sm border border-line-strong bg-surface px-3 py-2.5 text-ink placeholder:text-muted"
        />
        <Button
          variant={needsConfirm ? 'danger' : 'primary'}
          onClick={submit}
          disabled={disabled || text.trim().length === 0}
        >
          {needsConfirm ? 'Auf eigene Verantwortung senden' : 'Senden'}
        </Button>
      </div>
    </div>
  )
}
