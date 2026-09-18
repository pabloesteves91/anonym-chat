import { useState, type KeyboardEvent } from 'react'
import { Button } from './ui'
import { scanText } from '../services/wordFilter'

/**
 * Eingabezeile. Der Wortfilter läuft schon beim Tippen und warnt vorab –
 * gesendet wird trotzdem, markiert wird hinterher.
 */
export function Composer({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('')
  const verdict = text.trim().length > 2 ? scanText(text) : null

  const submit = () => {
    const value = text.trim()
    if (!value || disabled) return
    onSend(value)
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-line px-4 py-3">
      {verdict ? (
        <p className="mb-2 font-mono text-[0.6875rem] tracking-wide text-signal uppercase" aria-live="polite">
          Hinweis: {verdict.reason}. Diese Nachricht würde markiert.
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor="nachricht" className="sr-only">
          Nachricht
        </label>
        <textarea
          id="nachricht"
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Nachricht schreiben – Enter sendet, Shift+Enter macht eine neue Zeile"
          className="max-h-32 min-h-[2.75rem] flex-1 resize-y rounded-sm border border-line-strong bg-surface px-3 py-2.5 text-ink placeholder:text-muted"
        />
        <Button variant="primary" onClick={submit} disabled={disabled || text.trim().length === 0}>
          Senden
        </Button>
      </div>
    </div>
  )
}
