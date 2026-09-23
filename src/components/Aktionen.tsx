import { useEffect, useState } from 'react'
import { Button, Note, Panel, inputClass } from './ui'
import * as api from '../services/api'
import {
  NAME_MAX,
  NEUE_AKTION,
  RABATT_TARIFE,
  RELEASE_VORLAGE,
  TEXT_MAX,
  TITEL_MAX,
  aktionsStand,
  datumKurz,
  hinweis,
  normiereCode,
  pruefeAktion,
  tarifeText,
  type AboDauer,
  type Aktion,
  type RabattTarif,
} from '../services/aktion'

/** ISO-Zeitstempel → "JJJJ-MM-TT" in der Zeitzone des Geräts. */
function alsDatum(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "JJJJ-MM-TT" → Mitternacht dieses Tages, als ISO-Zeitstempel. */
function alsStart(datum: string): string | null {
  return datum ? new Date(`${datum}T00:00:00`).toISOString() : null
}

const zahl = (wert: string) => (wert.trim() === '' ? NaN : Number(wert))
const TAG = 86_400_000

const TARIF_LABEL: Record<RabattTarif, string> = {
  'plus-monat': 'Plus monatlich',
  'plus-jahr': 'Plus jährlich',
  lifetime: 'Lifetime',
}

/** Was eine Aktion gerade tut – für die Liste. */
function standText(aktion: Aktion): { text: string; laeuft: boolean } {
  const stand = aktionsStand(aktion)
  if (!aktion.aktiv) return { text: 'Ausgeschaltet', laeuft: false }
  if (stand.startetAm) return { text: `Geplant ab ${datumKurz(stand.startetAm)}`, laeuft: false }
  if (stand.vorbei) return { text: 'Abgelaufen', laeuft: false }
  const teile = [
    stand.gratis && stand.gratisBis ? `gratis bis und mit ${datumKurz(stand.gratisBis)}` : null,
    stand.rabatt && stand.rabattBis ? `${stand.rabatt} % bis und mit ${datumKurz(stand.rabattBis)}` : null,
  ].filter(Boolean)
  return { text: `Läuft: ${teile.join(' · ')}`, laeuft: true }
}

interface Entwurf {
  name: string
  aktiv: boolean
  datum: string
  gratis: string
  prozent: string
  rabattTage: string
  tarife: RabattTarif[]
  aboDauer: AboDauer
  aboMonate: string
  code: string
  hinweisTitel: string
  hinweisText: string
}

function zuEntwurf(aktion: Omit<Aktion, 'id'>): Entwurf {
  return {
    name: aktion.name,
    aktiv: aktion.aktiv,
    datum: alsDatum(aktion.start),
    gratis: String(aktion.gratisTage),
    prozent: String(aktion.rabattProzent),
    rabattTage: String(aktion.rabattTage),
    tarife: [...aktion.tarife],
    aboDauer: aktion.aboDauer,
    aboMonate: String(aktion.aboMonate),
    code: aktion.code ?? '',
    hinweisTitel: aktion.hinweisTitel,
    hinweisText: aktion.hinweisText,
  }
}

function ausEntwurf(id: string, e: Entwurf): Aktion {
  const code = normiereCode(e.code)
  return {
    id,
    name: e.name.trim(),
    aktiv: e.aktiv,
    start: alsStart(e.datum),
    gratisTage: zahl(e.gratis),
    rabattProzent: zahl(e.prozent),
    rabattTage: zahl(e.rabattTage),
    tarife: RABATT_TARIFE.filter((t) => e.tarife.includes(t)),
    aboDauer: e.aboDauer,
    aboMonate: zahl(e.aboMonate),
    code: code || null,
    hinweisTitel: e.hinweisTitel.trim(),
    hinweisText: e.hinweisText.trim(),
  }
}

function Feld({ id, label, children, hilfe }: { id: string; label: string; children: React.ReactNode; hilfe?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hilfe ? <p className="text-xs text-muted">{hilfe}</p> : null}
    </div>
  )
}

/** Eine Aktion bearbeiten oder neu anlegen. */
function Editor({
  id,
  vorlage,
  vergeben,
  onFertig,
}: {
  id: string
  vorlage: Omit<Aktion, 'id'>
  /** Codes anderer Aktionen – ein Code darf nur einmal vorkommen. */
  vergeben: string[]
  onFertig: () => void
}) {
  const [e, setE] = useState<Entwurf>(() => zuEntwurf(vorlage))
  const [busy, setBusy] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const aendern = (patch: Partial<Entwurf>) => {
    setE((alt) => ({ ...alt, ...patch }))
    setMeldung(null)
  }
  const aktion = ausEntwurf(id, e)
  const fehler =
    pruefeAktion(aktion) ?? (aktion.code && vergeben.includes(aktion.code) ? `Den Code ${aktion.code} hat schon eine andere Aktion.` : null)
  const p = (feld: string) => `aktion-${id || 'neu'}-${feld}`

  // Vorschau mit den Werten im Formular: was an welchem Tag gilt, und wie der Hinweis aussieht.
  const vorschau = (() => {
    if (fehler || !aktion.start) return null
    const beginn = new Date(aktion.start)
    const bisTag = (tage: number) => datumKurz(new Date(beginn.getTime() + tage * TAG - 1))
    return {
      beginn: datumKurz(beginn),
      gratis: aktion.gratisTage > 0 && !aktion.code ? bisTag(aktion.gratisTage) : null,
      rabatt: aktion.rabattProzent > 0 && aktion.rabattTage > 0 ? bisTag(aktion.rabattTage) : null,
      hinweis: hinweis({ ...aktion, aktiv: true }, beginn.getTime()),
    }
  })()

  const speichern = async () => {
    if (fehler) return
    setBusy(true)
    setMeldung(null)
    try {
      await api.speichereAktion(aktion)
      onFertig()
    } catch (error) {
      setMeldung(error instanceof api.ApiError ? error.message : 'Speichern fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const heute = alsDatum(new Date().toISOString())

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-line-strong bg-raised p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld id={p('name')} label="Name (nur intern)">
          <input
            id={p('name')}
            className={inputClass}
            maxLength={NAME_MAX}
            value={e.name}
            placeholder="z. B. Release, Sommer 2027"
            onChange={(ev) => aendern({ name: ev.target.value })}
          />
        </Feld>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={e.aktiv}
              onChange={(ev) => aendern({ aktiv: ev.target.checked })}
              className="size-4 accent-[var(--accent)]"
            />
            <span className="font-medium">Eingeschaltet</span>
          </label>
        </div>

        <Feld id={p('start')} label="Starttag" hilfe="Beginn um 00:00 Uhr. Gratis- und Rabatttage zählen ab hier.">
          <div className="flex gap-2">
            <input
              id={p('start')}
              type="date"
              className={`${inputClass} flex-1`}
              value={e.datum}
              onChange={(ev) => aendern({ datum: ev.target.value })}
            />
            <Button size="sm" variant="quiet" onClick={() => aendern({ datum: heute })}>
              Heute
            </Button>
          </div>
        </Feld>
        <Feld
          id={p('gratis')}
          label="Gratis-Tage"
          hilfe={e.code.trim() ? 'Nicht mit Gutscheincode – gratis gilt immer für alle.' : '0 = keine Gratiszeit. Alle Plus-Funktionen für jedes Konto.'}
        >
          <input
            id={p('gratis')}
            type="number"
            min={0}
            max={90}
            inputMode="numeric"
            className={inputClass}
            value={e.gratis}
            onChange={(ev) => aendern({ gratis: ev.target.value })}
          />
        </Feld>

        <Feld id={p('prozent')} label="Rabatt in %" hilfe="0 = kein Rabatt.">
          <input
            id={p('prozent')}
            type="number"
            min={0}
            max={90}
            inputMode="numeric"
            className={inputClass}
            value={e.prozent}
            onChange={(ev) => aendern({ prozent: ev.target.value })}
          />
        </Feld>
        <Feld id={p('rabatttage')} label="Rabatt-Tage (ab Start)">
          <input
            id={p('rabatttage')}
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            className={inputClass}
            value={e.rabattTage}
            onChange={(ev) => aendern({ rabattTage: ev.target.value })}
          />
        </Feld>
      </div>

      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 text-sm font-medium">Rabatt gilt für</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {RABATT_TARIFE.map((tarif) => (
            <label key={tarif} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={e.tarife.includes(tarif)}
                onChange={(ev) =>
                  aendern({ tarife: ev.target.checked ? [...e.tarife, tarif] : e.tarife.filter((t) => t !== tarif) })
                }
                className="size-4 accent-[var(--accent)]"
              />
              {TARIF_LABEL[tarif]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Feld id={p('dauer')} label="Bei Abos gilt der Rabatt" hilfe="Lifetime ist eine einzige Zahlung – dort gilt er immer ganz.">
          <select
            id={p('dauer')}
            className={inputClass}
            value={e.aboDauer}
            onChange={(ev) => aendern({ aboDauer: ev.target.value as AboDauer })}
          >
            <option value="einmal">nur für die erste Zahlung</option>
            <option value="monate">für die ersten … Monate</option>
            <option value="dauerhaft">dauerhaft, solange das Abo läuft</option>
          </select>
        </Feld>
        {e.aboDauer === 'monate' ? (
          <Feld id={p('monate')} label="Anzahl Monate" hilfe="1 bis 24.">
            <input
              id={p('monate')}
              type="number"
              min={1}
              max={24}
              inputMode="numeric"
              className={inputClass}
              value={e.aboMonate}
              onChange={(ev) => aendern({ aboMonate: ev.target.value })}
            />
          </Feld>
        ) : (
          <div />
        )}

        <Feld
          id={p('code')}
          label="Gutscheincode (optional)"
          hilfe="Leer: gilt für alle. Mit Code: nur wer ihn eingibt – auf der Tarifseite oder per Link /preise?code=…"
        >
          <input
            id={p('code')}
            className={`${inputClass} font-mono uppercase`}
            maxLength={20}
            value={e.code}
            placeholder="z. B. SOMMER25"
            autoComplete="off"
            spellCheck={false}
            onChange={(ev) => aendern({ code: ev.target.value })}
          />
        </Feld>
        <div />

        <Feld id={p('titel')} label="Eigener Hinweistitel (optional)" hilfe="Leer: wird aus den Werten erzeugt.">
          <input
            id={p('titel')}
            className={inputClass}
            maxLength={TITEL_MAX}
            value={e.hinweisTitel}
            onChange={(ev) => aendern({ hinweisTitel: ev.target.value })}
          />
        </Feld>
        <Feld id={p('text')} label="Eigener Hinweistext (optional)" hilfe={`Höchstens ${TEXT_MAX} Zeichen. Leer: wird erzeugt.`}>
          <textarea
            id={p('text')}
            rows={3}
            className={`${inputClass} resize-y`}
            maxLength={TEXT_MAX}
            value={e.hinweisText}
            onChange={(ev) => aendern({ hinweisText: ev.target.value })}
          />
        </Feld>
      </div>

      {fehler ? (
        <Note tone="warn">{fehler}</Note>
      ) : vorschau ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-muted">
            Start am <strong className="text-ink">{vorschau.beginn}</strong>
            {vorschau.gratis ? (
              <>
                {' '}
                · gratis bis und mit <strong className="text-ink">{vorschau.gratis}</strong>
              </>
            ) : null}
            {vorschau.rabatt ? (
              <>
                {' '}
                · {aktion.rabattProzent} % auf {tarifeText(aktion.tarife)} bis und mit{' '}
                <strong className="text-ink">{vorschau.rabatt}</strong>
              </>
            ) : null}
            {!e.aktiv ? ' – gespeichert, aber ausgeschaltet.' : '.'}
          </p>
          <div className="rounded-sm border border-accent/45 bg-accent-soft p-3">
            <p className="label-caps text-accent-strong">Vorschau des Hinweises{aktion.code ? ' (nur mit Code sichtbar)' : ''}</p>
            <p className="mt-1 font-semibold">{vorschau.hinweis.titel}</p>
            {vorschau.hinweis.punkte.map((punkt) => (
              <p key={punkt} className="mt-1 whitespace-pre-line">
                {punkt}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {meldung ? <Note tone="warn">{meldung}</Note> : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={busy || Boolean(fehler)} onClick={() => void speichern()}>
          {busy ? 'Speichert …' : 'Speichern'}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onFertig}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}

function Loeschen({ aktion }: { aktion: Aktion }) {
  const [frage, setFrage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  if (!frage) {
    return (
      <Button size="sm" variant="danger" onClick={() => setFrage(true)}>
        Löschen
      </Button>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm">„{aktion.name}" endgültig löschen?</span>
      <Button
        size="sm"
        variant="danger"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          api
            .loescheAktion(aktion.id)
            .catch((error) => setFehler(error instanceof api.ApiError ? error.message : 'Löschen fehlgeschlagen.'))
            .finally(() => setBusy(false))
        }}
      >
        Ja, löschen
      </Button>
      <Button size="sm" variant="quiet" disabled={busy} onClick={() => setFrage(false)}>
        Abbrechen
      </Button>
      {fehler ? <Note tone="warn">{fehler}</Note> : null}
    </span>
  )
}

/**
 * Aktionen verwalten – nur die Verwaltung.
 *
 * Wirkt sofort für alle: Die Seite liest die Aktionen live. Die Regeln in
 * firestore.rules prüfen dieselben Grenzen wie `pruefeAktion`.
 */
export function Aktionen() {
  const [aktionen, setAktionen] = useState<Aktion[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  // null: nichts offen; 'neu' / 'release': neue Aktion; sonst die Kennung.
  const [offen, setOffen] = useState<string | null>(null)

  useEffect(() => api.watchAlleAktionen(setAktionen, setFehler), [])

  const codes = (ausser: string) =>
    (aktionen ?? []).filter((a) => a.id !== ausser && a.code).map((a) => a.code as string)
  const hatRelease = (aktionen ?? []).some((a) => a.name.trim().toLowerCase() === 'release')

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Aktionen</h2>
        <p className="mt-1 text-sm text-muted">
          Gratiszeiten, Rabatte und Gutscheincodes. Eine Aktion zählt ab ihrem Starttag: eine Zeit lang alle
          Plus-Funktionen gratis, und/oder eine Zeit lang Rabatt auf die gewählten Tarife. Überschneiden sich Aktionen,
          gilt pro Tarif der höchste Rabatt. Speichern wirkt sofort für alle.
        </p>
      </div>

      {fehler ? <Note tone="warn">{fehler}</Note> : null}

      {aktionen === null && !fehler ? (
        <p className="label-caps" role="status">
          Wird geladen …
        </p>
      ) : null}

      {aktionen?.length === 0 && offen === null ? <p className="text-sm text-muted">Noch keine Aktion angelegt.</p> : null}

      <ul className="flex flex-col gap-3">
        {(aktionen ?? []).map((aktion) => {
          const stand = standText(aktion)
          return (
            <li key={aktion.id} className="flex flex-col gap-3 rounded-sm border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{aktion.name}</span>
                    {aktion.code ? (
                      <span className="rounded-sm border border-line-strong px-1.5 font-mono text-xs">{aktion.code}</span>
                    ) : null}
                  </p>
                  <p className={`mt-0.5 text-sm ${stand.laeuft ? 'font-medium text-accent-strong' : 'text-muted'}`}>
                    {stand.text}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[
                      aktion.gratisTage > 0 && !aktion.code ? `${aktion.gratisTage} Tage gratis` : null,
                      aktion.rabattProzent > 0
                        ? `${aktion.rabattProzent} % auf ${tarifeText(aktion.tarife)} für ${aktion.rabattTage} Tage`
                        : null,
                      aktion.start ? `ab ${datumKurz(new Date(aktion.start))}` : 'kein Starttag',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {offen !== aktion.id ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setOffen(aktion.id)}>
                      Bearbeiten
                    </Button>
                    <Loeschen aktion={aktion} />
                  </div>
                ) : null}
              </div>
              {offen === aktion.id ? (
                <Editor id={aktion.id} vorlage={aktion} vergeben={codes(aktion.id)} onFertig={() => setOffen(null)} />
              ) : null}
            </li>
          )
        })}
      </ul>

      {offen === 'neu' || offen === 'release' ? (
        <Editor
          id=""
          vorlage={offen === 'release' ? RELEASE_VORLAGE : NEUE_AKTION}
          vergeben={codes('')}
          onFertig={() => setOffen(null)}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={aktionen === null} onClick={() => setOffen('neu')}>
            Neue Aktion
          </Button>
          {aktionen !== null && !hatRelease ? (
            <Button onClick={() => setOffen('release')}>Release-Aktion vorbereiten</Button>
          ) : null}
        </div>
      )}
    </Panel>
  )
}
