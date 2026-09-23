import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Field, Note, PageTitle, Panel, inputClass } from '../components/ui'
import { Kontokennung } from '../components/Kontokennung'
import { BETREIBER } from '../content/legal'
import { planById } from '../services/plans'
import {
  BETREFF_MAX,
  SUPPORT_THEMEN,
  TEXT_MAX,
  TEXT_MIN,
  themaLabel,
  validateAntwortadresse,
  validateSupportAnfrage,
} from '../services/support'
import type { SupportAnfrage, SupportStatus, SupportThema } from '../services/types'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'
import { useSupport } from '../store/useSupport'

const STATUS_LABEL: Record<SupportStatus, string> = {
  offen: 'Offen',
  inArbeit: 'In Arbeit',
  erledigt: 'Erledigt',
}

const STATUS_STYLE: Record<SupportStatus, string> = {
  offen: 'border-line-strong bg-raised text-muted',
  inArbeit: 'border-accent/45 bg-accent-soft text-accent-strong',
  erledigt: 'border-line bg-raised text-muted',
}

/**
 * Was ein Thema zusätzlich erklären muss, bevor jemand abschickt.
 *
 * Nur dort, wo die Antwort unangenehm oder überraschend ist – ein Hinweis an
 * jedem Punkt wäre Geraune.
 */
const VORWARNUNG: Partial<Record<SupportThema, string>> = {
  'konto-loeschen':
    'Mit der Löschung verschwinden Profil und Mitgliedschaft. Bestehende Meldungen und Sperren bleiben bestehen – sie wären sonst wirkungslos. Rückgängig machen lässt sich das nicht.',
  geschlecht:
    'Mit der Korrektur bekommst du einen neuen Anzeigenamen; der alte hängt an der bisherigen Angabe und lässt sich nicht behalten.',
  gesperrt:
    'Schreib bitte dazu, worum es im Gespräch ging. Wir sehen den Verlauf nur 72 Stunden lang – danach lässt sich eine Sperre nicht mehr überprüfen.',
}

function Anfragezeile({ anfrage }: { anfrage: SupportAnfrage }) {
  const datum = new Date(anfrage.createdAt).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-surface px-3 py-2.5 text-sm">
      <span
        className={`rounded-sm border px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide uppercase ${STATUS_STYLE[anfrage.status]}`}
      >
        {STATUS_LABEL[anfrage.status]}
      </span>
      <span className="font-medium">{anfrage.betreff}</span>
      <span className="text-muted">{themaLabel(anfrage.thema)}</span>
      <span className="ml-auto font-mono text-xs text-muted">{datum}</span>
    </li>
  )
}

export function Support() {
  const konto = useAuth((s) => s.user)
  const user = useSession((s) => s.user)

  const eigene = useSupport((s) => s.eigene)
  const ready = useSupport((s) => s.ready)
  const busy = useSupport((s) => s.busy)
  const storeFehler = useSupport((s) => s.error)
  const load = useSupport((s) => s.load)
  const absenden = useSupport((s) => s.absenden)
  const clearError = useSupport((s) => s.clearError)

  const [thema, setThema] = useState<SupportThema | ''>('')
  const [betreff, setBetreff] = useState('')
  const [text, setText] = useState('')
  // Die Adresse wird nicht in einen Effekt geschrieben, sondern beim Rendern
  // abgeleitet: Solange niemand getippt hat, gilt die Adresse des Kontos –
  // die steht beim ersten Rendern oft noch nicht fest.
  const [eigeneAdresse, setEigeneAdresse] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [gesendet, setGesendet] = useState<SupportAnfrage | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  // Überschreiben darf man sie: Wer sich über Apple mit verdeckter Adresse
  // angemeldet hat, liest dort womöglich nicht mit.
  const antwortAn = eigeneAdresse ?? konto?.email ?? ''

  const gewaehlt = useMemo(() => SUPPORT_THEMEN.find((t) => t.value === thema), [thema])

  /**
   * Wer etwas ändert, hat auf die Meldung reagiert.
   *
   * Bliebe sie stehen, widerspräche sie sichtbar dem Formular – „Bitte wähle
   * aus, worum es geht" unter einer getroffenen Auswahl liest sich wie ein
   * Fehler der Seite.
   */
  const aendern = <T,>(setzen: (wert: T) => void) => (wert: T) => {
    if (fehler) setFehler(null)
    if (storeFehler) clearError()
    setzen(wert)
  }

  const senden = async () => {
    setFehler(null)
    clearError()

    const inhalt = validateSupportAnfrage({ thema, betreff, text })
    if (!inhalt.ok) {
      setFehler(inhalt.error ?? 'Da fehlt noch etwas.')
      return
    }
    const adresse = validateAntwortadresse(antwortAn)
    if (!adresse.ok) {
      setFehler(adresse.error ?? 'Die Adresse stimmt nicht.')
      return
    }

    const anfrage = await absenden({
      thema: thema as SupportThema,
      betreff: betreff.trim(),
      text: text.trim(),
      antwortAn: antwortAn.trim(),
    })
    if (!anfrage) return

    setGesendet(anfrage)
    setThema('')
    setBetreff('')
    setText('')
  }

  const rest = TEXT_MAX - text.trim().length

  return (
    <div className="flex flex-col gap-8">
      <PageTitle kicker="Wir lesen mit">Support</PageTitle>

      <p className="prose-column -mt-4 text-muted">
        Manches lässt sich im Dienst nicht selbst erledigen – die Geschlechtsangabe zum Beispiel, oder die Löschung
        deines Kontos. Schreib uns hier, und wir kümmern uns von Hand darum.
      </p>

      {gesendet ? (
        <Panel className="border-accent/40 bg-accent-soft p-6">
          <h2 className="font-display text-xl font-semibold">Angekommen</h2>
          <p className="mt-2 text-sm">
            Deine Anfrage „{gesendet.betreff}" liegt uns vor. Wir antworten an{' '}
            <span className="font-mono">{gesendet.antwortAn}</span>. Den Stand siehst du unten.
          </p>
          <div className="mt-4">
            <Button size="sm" onClick={() => setGesendet(null)}>
              Weitere Anfrage schreiben
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel className="flex flex-col gap-5 p-5 sm:p-6">
          <Field
            label="Worum geht es?"
            htmlFor="support-thema"
            hint={gewaehlt?.hint ?? 'Wähle den Punkt, der am ehesten passt.'}
          >
            <select
              id="support-thema"
              className={inputClass}
              value={thema}
              onChange={(event) => aendern(setThema)(event.target.value as SupportThema | '')}
            >
              <option value="">Bitte auswählen …</option>
              {SUPPORT_THEMEN.map((eintrag) => (
                <option key={eintrag.value} value={eintrag.value}>
                  {eintrag.label}
                </option>
              ))}
            </select>
          </Field>

          {gewaehlt && VORWARNUNG[gewaehlt.value] ? <Note tone="warn">{VORWARNUNG[gewaehlt.value]}</Note> : null}

          <Field label="Betreff" htmlFor="support-betreff" hint={`Ein Satz genügt. Höchstens ${BETREFF_MAX} Zeichen.`}>
            <input
              id="support-betreff"
              className={inputClass}
              maxLength={BETREFF_MAX}
              value={betreff}
              onChange={(event) => aendern(setBetreff)(event.target.value)}
              placeholder="Kurz gesagt: worum geht es?"
            />
          </Field>

          <Field
            label="Beschreibung"
            htmlFor="support-text"
            hint={
              text.trim().length < TEXT_MIN
                ? `Mindestens ${TEXT_MIN} Zeichen – je genauer, desto schneller sind wir durch.`
                : `Noch ${rest} Zeichen frei.`
            }
          >
            <textarea
              id="support-text"
              rows={7}
              maxLength={TEXT_MAX}
              className={`${inputClass} resize-y`}
              value={text}
              onChange={(event) => aendern(setText)(event.target.value)}
              placeholder="Was ist passiert, was erwartest du von uns? Adressen, Nummern und Verweise darfst du hineinschreiben – dieses Feld wird nicht gefiltert."
            />
          </Field>

          <Field
            label="Antwort an"
            htmlFor="support-antwort"
            hint="Vorbelegt mit der Adresse deines Kontos. Änderbar, falls du dort nicht mitliest."
          >
            <input
              id="support-antwort"
              type="email"
              autoComplete="email"
              className={`${inputClass} font-mono`}
              value={antwortAn}
              onChange={(event) => aendern(setEigeneAdresse)(event.target.value)}
            />
          </Field>

          <Note as="div">
            <p className="font-medium text-ink">Automatisch mitgeschickt wird:</p>
            <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5">
              <li>Deine Kontokennung – damit wir die Anfrage zuordnen können</li>
              <li>Dein Anzeigename {user ? <span className="font-mono">({user.pseudonym})</span> : null}</li>
              <li>
                Dein Verifizierungsstand und dein Tarif
                {user ? <span className="font-mono"> ({planById(user.membership.plan).name})</span> : null}
              </li>
            </ul>
            <p className="mt-2">
              Nichts davon bekommen andere Nutzende zu sehen. Dein Ausweisfoto und deine Mobilnummer gehen nicht mit.
            </p>
          </Note>

          {fehler ? <Note tone="warn">{fehler}</Note> : null}
          {storeFehler ? <Note tone="warn">{storeFehler}</Note> : null}

          <div>
            <Button variant="primary" disabled={busy} onClick={() => void senden()}>
              {busy ? 'Wird gesendet …' : 'Anfrage abschicken'}
            </Button>
          </div>
        </Panel>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Deine Anfragen</h2>
        {!ready ? (
          <p className="label-caps" role="status">
            Wird geladen …
          </p>
        ) : eigene.length === 0 ? (
          <p className="text-sm text-muted">Noch keine. Was du hier schickst, erscheint samt Stand in dieser Liste.</p>
        ) : (
          <ul className="flex flex-col gap-px overflow-hidden rounded-sm border border-line bg-line">
            {eigene.map((anfrage) => (
              <Anfragezeile key={anfrage.id} anfrage={anfrage} />
            ))}
          </ul>
        )}
      </section>

      {konto ? (
        <Kontokennung
          id={konto.uid}
          hinweis="Diese Kennung hängt an jeder Anfrage. Du musst sie nicht abtippen."
        />
      ) : null}

      <Note as="div">
        <p>
          Missbrauch im Chat meldest du nicht hier, sondern direkt im Gespräch über „Melden" – dann geht der Auszug
          mit, und die Moderation kann ihn einordnen.
        </p>
        <p className="mt-2">
          Kommst du nicht mehr in dein Konto und erreichst diese Seite gar nicht? Dann hilft die Adresse im{' '}
          <Link to="/impressum" className="underline underline-offset-2 hover:text-ink">
            Impressum
          </Link>
          : <span className="font-mono">{BETREIBER.email}</span>
        </p>
      </Note>
    </div>
  )
}
