import { useEffect, useRef, useState } from 'react'
import { Button, Note, inputClass } from './ui'
import * as api from '../services/api'
import type { SupportNachricht } from '../services/types'

const zeit = (ms: number) =>
  new Date(ms).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/**
 * Der Supportchat – für die Moderation und die Person gleichermassen.
 *
 * Ein Baustein für beide Seiten, damit beide dasselbe sehen. Was sich
 * unterscheidet, sagt `seite`: wer "ich" ist, wie die Gegenseite heisst.
 *
 * Kein Wortfilter: Wie beim Formular der Supportseite gehören Adressen,
 * Nummern und Verweise hier zum Zweck. Gelesen wird ohnehin von Menschen.
 *
 * Gelesen gilt, was angezeigt wurde. Der Chat ist nur eingeblendet, wenn
 * jemand ihn ansieht; eine Markierung "ungelesen" wird deshalb beim Anzeigen
 * weggenommen.
 */
export function SupportChat({
  anfrageId,
  seite,
  gegenueber,
  schreibbar,
  ungelesen,
}: {
  anfrageId: string
  seite: SupportNachricht['von']
  /** Wie die Gegenseite im Verlauf heisst. */
  gegenueber: string
  /** Darf gerade geschrieben werden? Bei erledigten Anfragen nicht mehr. */
  schreibbar: boolean
  /** Liegt auf der eigenen Seite eine ungelesene Nachricht? */
  ungelesen: boolean
}) {
  const [nachrichten, setNachrichten] = useState<SupportNachricht[] | null>(null)
  const [entwurf, setEntwurf] = useState('')
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const ende = useRef<HTMLDivElement>(null)

  useEffect(() => api.watchSupportNachrichten(anfrageId, setNachrichten), [anfrageId])

  // Angezeigt heisst gelesen – aber nur, wenn der Tab auch wirklich vorne
  // liegt. Sonst gälte eine Antwort als gelesen, während die Seite im
  // Hintergrund offen steht, und das Blinken bliebe aus, obwohl niemand sie
  // gesehen hat. Kommt der Tab nach vorne, wird nachgeholt.
  useEffect(() => {
    if (!ungelesen || nachrichten === null) return
    const markieren = () => {
      if (document.visibilityState === 'visible') {
        void api.markiereSupportGelesen(anfrageId, seite).catch(() => {})
      }
    }
    markieren()
    document.addEventListener('visibilitychange', markieren)
    return () => document.removeEventListener('visibilitychange', markieren)
  }, [ungelesen, nachrichten, anfrageId, seite])

  // Neue Nachrichten ins Bild holen – innerhalb des Verlaufs, ohne die Seite
  // mitzuziehen.
  useEffect(() => {
    ende.current?.scrollIntoView({ block: 'nearest' })
  }, [nachrichten?.length])

  const senden = async () => {
    const text = entwurf.trim()
    if (!text || sendet) return
    setSendet(true)
    setFehler(null)
    try {
      await api.sendeSupportNachricht(anfrageId, text, seite)
      setEntwurf('')
    } catch (error) {
      setFehler(error instanceof api.ApiError ? error.message : 'Die Nachricht konnte nicht gesendet werden.')
    } finally {
      setSendet(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex max-h-96 min-h-32 flex-col gap-3 overflow-y-auto rounded-sm border border-line bg-raised p-3"
        aria-live="polite"
        aria-label="Verlauf des Supportchats"
      >
        {nachrichten === null ? (
          <p className="label-caps" role="status">
            Wird geladen …
          </p>
        ) : nachrichten.length === 0 ? (
          <p className="text-sm text-muted">
            {seite === 'moderation'
              ? 'Noch keine Nachrichten. Bei der Person steht oben jetzt „Support". Sobald du schreibst, blinkt es.'
              : 'Der Support hat den Chat eröffnet. Die erste Nachricht kommt gleich.'}
          </p>
        ) : (
          nachrichten.map((n) => {
            const meine = n.von === seite
            return (
              <div key={n.id} className={`flex flex-col ${meine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-sm border px-3 py-2 sm:max-w-[75%] ${
                    meine ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
                  }`}
                >
                  <p className="text-[0.9375rem] whitespace-pre-wrap">{n.text}</p>
                </div>
                <p className="mt-1 font-mono text-xs text-muted">
                  {meine ? 'Du' : gegenueber} · {zeit(n.at)}
                </p>
              </div>
            )
          })
        )}
        <div ref={ende} />
      </div>

      {schreibbar ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label htmlFor={`chat-${anfrageId}`} className="sr-only">
            Nachricht an {gegenueber}
          </label>
          <textarea
            id={`chat-${anfrageId}`}
            rows={2}
            maxLength={2000}
            className={`${inputClass} flex-1 resize-y`}
            value={entwurf}
            onChange={(event) => setEntwurf(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void senden()
              }
            }}
            placeholder={`Nachricht an ${gegenueber}. Enter sendet, Shift+Enter macht eine neue Zeile.`}
          />
          <Button variant="primary" disabled={sendet || !entwurf.trim()} onClick={() => void senden()}>
            {sendet ? 'Sendet …' : 'Senden'}
          </Button>
        </div>
      ) : (
        <Note>Die Anfrage ist erledigt, der Chat ist geschlossen. Was besprochen wurde, bleibt hier lesbar.</Note>
      )}

      {fehler ? <Note tone="warn">{fehler}</Note> : null}
    </div>
  )
}
