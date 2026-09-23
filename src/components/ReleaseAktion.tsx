import { useState } from 'react'
import { Button, Note, Panel, inputClass } from './ui'
import * as api from '../services/api'
import { aktionsStand, datumKurz, pruefeAktion, type Aktion } from '../services/aktion'
import { useAktion } from '../store/useAktion'

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

/**
 * Die Release-Aktion einstellen – nur die Verwaltung.
 *
 * Wirkt sofort für alle: Die Seite liest die Einstellung live. Die Regeln in
 * firestore.rules prüfen dieselben Grenzen wie `pruefeAktion`.
 */
export function ReleaseAktion() {
  const gespeichert = useAktion((s) => s.aktion)
  const bereit = useAktion((s) => s.bereit)
  const [entwurf, setEntwurf] = useState<{ aktiv: boolean; datum: string; gratis: string; prozent: string; rabattTage: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [meldung, setMeldung] = useState<{ ton: 'ok' | 'warn'; text: string } | null>(null)

  // Solange nichts geändert wurde, zeigt das Formular den gespeicherten Stand.
  const werte = entwurf ?? {
    aktiv: gespeichert.aktiv,
    datum: alsDatum(gespeichert.start),
    gratis: String(gespeichert.gratisTage),
    prozent: String(gespeichert.rabattProzent),
    rabattTage: String(gespeichert.rabattTage),
  }
  const aendern = (patch: Partial<typeof werte>) => {
    setEntwurf({ ...werte, ...patch })
    setMeldung(null)
  }

  const aktion: Aktion = {
    aktiv: werte.aktiv,
    start: alsStart(werte.datum),
    gratisTage: zahl(werte.gratis),
    rabattProzent: zahl(werte.prozent),
    rabattTage: zahl(werte.rabattTage),
  }
  const fehler = pruefeAktion(aktion)

  // Vorschau: was an welchem Tag gilt – mit den Werten im Formular.
  const vorschau = (() => {
    if (fehler || !aktion.aktiv || !aktion.start) return null
    const beginn = new Date(aktion.start)
    const bisTag = (tage: number) => datumKurz(new Date(beginn.getTime() + tage * 86_400_000 - 1))
    return {
      beginn: datumKurz(beginn),
      gratis: aktion.gratisTage > 0 ? bisTag(aktion.gratisTage) : null,
      rabatt: aktion.rabattProzent > 0 && aktion.rabattTage > 0 ? bisTag(aktion.rabattTage) : null,
    }
  })()
  const jetzt = aktionsStand(gespeichert)

  const speichern = async () => {
    if (fehler) return
    setBusy(true)
    setMeldung(null)
    try {
      await api.speichereAktion(aktion)
      setEntwurf(null)
      setMeldung({ ton: 'ok', text: 'Gespeichert – gilt ab sofort für alle.' })
    } catch (error) {
      setMeldung({ ton: 'warn', text: error instanceof api.ApiError ? error.message : 'Speichern fehlgeschlagen.' })
    } finally {
      setBusy(false)
    }
  }

  const heute = alsDatum(new Date().toISOString())

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Release-Aktion</h2>
        <p className="mt-1 text-sm text-muted">
          Ab dem Starttag: eine Zeit lang alle Plus-Funktionen gratis für jedes Konto, und eine Zeit lang Rabatt auf
          jeden Tarif – bei Plus monatlich nur auf den ersten Monat. Startdatum ist der Tag, an dem die richtige Domain
          online geht; die Aktion beginnt dort um 00:00 Uhr.
        </p>
      </div>

      <p className="text-sm" role="status">
        <span className="label-caps mr-2">Jetzt</span>
        {!bereit
          ? 'Wird geladen …'
          : jetzt.gratis || jetzt.rabatt
            ? [
                jetzt.gratis && jetzt.gratisBis ? `gratis bis und mit ${datumKurz(jetzt.gratisBis)}` : null,
                jetzt.rabatt && jetzt.rabattBis ? `${jetzt.rabatt} % bis und mit ${datumKurz(jetzt.rabattBis)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : jetzt.startetAm
              ? `eingeschaltet, beginnt am ${datumKurz(jetzt.startetAm)}`
              : gespeichert.aktiv
                ? 'eingeschaltet, aber abgelaufen'
                : 'ausgeschaltet'}
      </p>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={werte.aktiv}
          onChange={(event) => aendern({ aktiv: event.target.checked })}
          className="size-4 accent-[var(--accent)]"
        />
        <span className="font-medium">Aktion eingeschaltet</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="aktion-start" className="text-sm font-medium">
            Starttag
          </label>
          <div className="flex gap-2">
            <input
              id="aktion-start"
              type="date"
              className={`${inputClass} flex-1`}
              value={werte.datum}
              onChange={(event) => aendern({ datum: event.target.value })}
            />
            <Button size="sm" variant="quiet" onClick={() => aendern({ datum: heute })}>
              Heute
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="aktion-gratis" className="text-sm font-medium">
            Gratis-Tage
          </label>
          <input
            id="aktion-gratis"
            type="number"
            min={0}
            max={90}
            inputMode="numeric"
            className={inputClass}
            value={werte.gratis}
            onChange={(event) => aendern({ gratis: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="aktion-prozent" className="text-sm font-medium">
            Rabatt in %
          </label>
          <input
            id="aktion-prozent"
            type="number"
            min={0}
            max={90}
            inputMode="numeric"
            className={inputClass}
            value={werte.prozent}
            onChange={(event) => aendern({ prozent: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="aktion-rabatttage" className="text-sm font-medium">
            Rabatt-Tage (ab Start)
          </label>
          <input
            id="aktion-rabatttage"
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            className={inputClass}
            value={werte.rabattTage}
            onChange={(event) => aendern({ rabattTage: event.target.value })}
          />
        </div>
      </div>

      {fehler ? (
        <Note tone="warn">{fehler}</Note>
      ) : vorschau ? (
        <p className="text-sm text-muted">
          Mit diesen Werten: Start am <strong className="text-ink">{vorschau.beginn}</strong>
          {vorschau.gratis ? (
            <>
              {' '}
              · gratis bis und mit <strong className="text-ink">{vorschau.gratis}</strong>
            </>
          ) : null}
          {vorschau.rabatt ? (
            <>
              {' '}
              · {aktion.rabattProzent} % bis und mit <strong className="text-ink">{vorschau.rabatt}</strong>
            </>
          ) : null}
          .
        </p>
      ) : !werte.aktiv ? (
        <p className="text-sm text-muted">Ausgeschaltet: keine Gratiszeit, kein Rabatt, kein Hinweis auf der Seite.</p>
      ) : null}

      {meldung ? <Note tone={meldung.ton === 'warn' ? 'warn' : undefined}>{meldung.text}</Note> : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={busy || Boolean(fehler) || entwurf === null} onClick={() => void speichern()}>
          {busy ? 'Speichert …' : 'Speichern'}
        </Button>
        {entwurf ? (
          <Button variant="quiet" disabled={busy} onClick={() => setEntwurf(null)}>
            Verwerfen
          </Button>
        ) : null}
      </div>
    </Panel>
  )
}
