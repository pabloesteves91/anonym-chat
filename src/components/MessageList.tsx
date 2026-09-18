import { useEffect, useRef } from 'react'
import type { Message } from '../services/types'

function zeit(ts: number) {
  return new Date(ts).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
}

function FlagHinweis({ text, level }: { text: string; level: 'mild' | 'severe' }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 border-t border-signal/30 pt-1.5 font-mono text-[0.6875rem] tracking-wide text-signal uppercase">
      <span aria-hidden="true">▲</span>
      {level === 'severe' ? 'Markiert' : 'Auffällig'}: {text}
    </p>
  )
}

function Bubble({ message }: { message: Message }) {
  if (message.author === 'system') {
    return (
      <li className="my-2 text-center">
        <span className="text-xs text-muted">{message.text}</span>
      </li>
    )
  }

  const mine = message.author === 'me'
  return (
    <li className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-sm border px-3 py-2 sm:max-w-[70%] ${
          mine ? 'border-accent/30 bg-accent-soft' : 'border-line bg-raised'
        } ${message.flag ? 'border-signal/50' : ''}`}
      >
        <p className="text-[0.9375rem] whitespace-pre-wrap">{message.text}</p>
        {message.flag ? <FlagHinweis text={message.flag.reason} level={message.flag.level} /> : null}
      </div>
      <span className="mt-1 font-mono text-[0.6875rem] text-muted">
        {mine ? 'Du' : 'Gegenüber'} · {zeit(message.ts)}
      </span>
    </li>
  )
}

export function TypingIndicator({ pseudonym }: { pseudonym: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-muted">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="typing-dot h-1.5 w-1.5 rounded-full bg-muted"
            style={{ animationDelay: `${index * 0.18}s` }}
          />
        ))}
      </span>
      {pseudonym} schreibt …
    </li>
  )
}

export function MessageList({
  messages,
  typing,
  partnerPseudonym,
}: {
  messages: Message[]
  typing: boolean
  partnerPseudonym: string
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, typing])

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
      <ol className="mt-auto flex flex-col gap-3" role="log" aria-live="polite" aria-label="Chatverlauf">
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        {typing ? <TypingIndicator pseudonym={partnerPseudonym} /> : null}
      </ol>
      <div ref={endRef} />
    </div>
  )
}
