import { useEffect, useState } from 'react'
import { Button, Note, Panel, inputClass } from './ui'
import * as api from '../services/api'
import {
  ARTEN,
  NEUE_NEUIGKEIT,
  TEXT_MAX,
  TITEL_MAX,
  artLabel,
  datumLang,
  pruefeNeuigkeit,
  type Neuigkeit,
  type NeuigkeitArt,
} from '../services/neuigkeiten'

const versionDatum = (iso: string) =>
  new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Betreff kürzen, damit die Auswahl lesbar bleibt. */
const kurz = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

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

function Editor({ vorlage, onFertig }: { vorlage: Neuigkeit; onFertig: () => void }) {
  const [n, setN] = useState<Neuigkeit>(vorlage)
  const [busy, setBusy] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const aendern = (patch: Partial<Neuigkeit>) => {
    setN((alt) => ({ ...alt, ...patch }))
    setMeldung(null)
  }
  const { id, ...daten } = n
  const fehler = pruefeNeuigkeit(daten)
  const p = (feld: string) => `neuigkeit-${id || 'neu'}-${feld}`

  // Die Auswahl: die letzten ausgerollten Fassungen, die erste ist die neueste.
  // Ein älterer Eintrag behält seine Version, auch wenn sie aus der Liste
  // gefallen ist.
  const versionen = [...__VERSIONEN__]
  if (n.version && !versionen.some((v) => v.id === n.version)) {
    versionen.push({ id: n.version, datum: '', titel: 'ältere Fassung' })
  }

  const speichern = async (veroeffentlicht: boolean) => {
    const eintrag = { ...n, veroeffentlicht }
    if (pruefeNeuigkeit({ ...daten, veroeffentlicht })) return
    setBusy(true)
    setMeldung(null)
    try {
      await api.speichereNeuigkeit(eintrag)
      onFertig()
    } catch (error) {
      setMeldung(error instanceof api.ApiError ? error.message : 'Speichern fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-line-strong bg-raised p-4">
      <Feld id={p('titel')} label="Titel">
        <input
          id={p('titel')}
          className={inputClass}
          maxLength={TITEL_MAX}
          value={n.titel}
          placeholder="z. B. Gutscheincodes auf der Tarifseite"
          onChange={(e) => aendern({ titel: e.target.value })}
        />
      </Feld>

      <div className="grid gap-4 sm:grid-cols-3">
        <Feld id={p('art')} label="Art">
          <select
            id={p('art')}
            className={inputClass}
            value={n.art}
            onChange={(e) => aendern({ art: e.target.value as NeuigkeitArt })}
          >
            {ARTEN.map((a) => (
              <option key={a.wert} value={a.wert}>
                {a.label}
              </option>
            ))}
          </select>
        </Feld>
        <Feld id={p('datum')} label="Datum">
          <input
            id={p('datum')}
            type="date"
            className={inputClass}
            value={n.datum}
            onChange={(e) => aendern({ datum: e.target.value })}
          />
        </Feld>
        <Feld id={p('version')} label="Version" hilfe="Die ausgerollten Fassungen, wie im Fuss der Seite.">
          <select
            id={p('version')}
            className={`${inputClass} font-mono text-sm`}
            value={n.version ?? ''}
            onChange={(e) => aendern({ version: e.target.value || null })}
          >
            <option value="">– ohne Version –</option>
            {versionen.map((v, i) => (
              <option key={v.id} value={v.id}>
                {v.id}
                {i === 0 && v.datum ? ' (neueste Version)' : ''}
                {v.datum ? ` · ${versionDatum(v.datum)} · ${kurz(v.titel)}` : ` · ${v.titel}`}
              </option>
            ))}
          </select>
        </Feld>
      </div>

      <Feld id={p('text')} label="Beschreibung" hilfe={`Was ist neu, was ändert sich für die Leute? Höchstens ${TEXT_MAX} Zeichen, Zeilenumbrüche bleiben.`}>
        <textarea
          id={p('text')}
          rows={5}
          maxLength={TEXT_MAX}
          className={`${inputClass} resize-y`}
          value={n.text}
          onChange={(e) => aendern({ text: e.target.value })}
        />
      </Feld>

      {fehler ? <Note tone="warn">{fehler}</Note> : null}
      {meldung ? <Note tone="warn">{meldung}</Note> : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={busy || Boolean(fehler)} onClick={() => void speichern(true)}>
          {busy ? 'Speichert …' : n.veroeffentlicht ? 'Speichern' : 'Veröffentlichen'}
        </Button>
        <Button disabled={busy || Boolean(fehler)} onClick={() => void speichern(false)}>
          {n.veroeffentlicht ? 'Zurück zu Entwurf' : 'Als Entwurf speichern'}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onFertig}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}

function Loeschen({ eintrag }: { eintrag: Neuigkeit }) {
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
      <span className="text-sm">Endgültig löschen?</span>
      <Button
        size="sm"
        variant="danger"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          api
            .loescheNeuigkeit(eintrag.id)
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
 * Neuigkeiten schreiben – nur die Verwaltung.
 *
 * Alles von Hand: Titel, Art, Datum, Version, Beschreibung. Veröffentlicht
 * erscheint es sofort unter „Neuigkeiten" und – der neueste Eintrag – auf der
 * Startseite. Entwürfe sieht nur die Verwaltung.
 */
export function NeuigkeitenVerwaltung() {
  const [liste, setListe] = useState<Neuigkeit[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  // null: nichts offen; 'neu': neuer Eintrag; sonst die Kennung.
  const [offen, setOffen] = useState<string | null>(null)

  useEffect(() => api.watchAlleNeuigkeiten(setListe, setFehler), [])

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Neuigkeiten</h2>
        <p className="mt-1 text-sm text-muted">
          Was sich geändert hat, für alle sichtbar unter „Neuigkeiten" – der neueste Eintrag auch auf der Startseite.
          Wer die Seite noch nicht gesehen hat, sieht einen Punkt am Menüpunkt.
        </p>
      </div>

      {fehler ? <Note tone="warn">{fehler}</Note> : null}
      {liste === null && !fehler ? (
        <p className="label-caps" role="status">
          Wird geladen …
        </p>
      ) : null}
      {liste?.length === 0 && offen === null ? <p className="text-sm text-muted">Noch keine Neuigkeiten.</p> : null}

      {offen === 'neu' ? <Editor vorlage={{ ...NEUE_NEUIGKEIT(), id: '' }} onFertig={() => setOffen(null)} /> : null}

      <ul className="flex flex-col gap-3">
        {(liste ?? []).map((eintrag) => (
          <li key={eintrag.id} className="flex flex-col gap-3 rounded-sm border border-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">{datumLang(eintrag.datum)}</span>
                  <span className="rounded-sm border border-line-strong px-1.5 text-xs">{artLabel(eintrag.art)}</span>
                  {eintrag.version ? <span className="font-mono text-xs text-muted">{eintrag.version}</span> : null}
                  {!eintrag.veroeffentlicht ? (
                    <span className="rounded-sm border border-signal/40 bg-signal-soft px-1.5 text-xs font-medium">Entwurf</span>
                  ) : null}
                </p>
                <p className="mt-1 font-semibold">{eintrag.titel}</p>
              </div>
              {offen !== eintrag.id ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setOffen(eintrag.id)}>
                    Bearbeiten
                  </Button>
                  <Loeschen eintrag={eintrag} />
                </div>
              ) : null}
            </div>
            {offen === eintrag.id ? <Editor vorlage={eintrag} onFertig={() => setOffen(null)} /> : null}
          </li>
        ))}
      </ul>

      {offen !== 'neu' ? (
        <div>
          <Button variant="primary" disabled={liste === null} onClick={() => setOffen('neu')}>
            Neuer Eintrag
          </Button>
        </div>
      ) : null}
    </Panel>
  )
}
