import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from './Dialog'
import { Button, Note } from './ui'
import { PLAENE, preisText, rappenText, type Plan, type PlanId } from '../services/plans'
import { dauerText, datumKurz, rabattiert } from '../services/aktion'
import { gratisZeitBis, rabattFuer, useAktionen } from '../store/useAktionen'
import { useSession } from '../store/useSession'
import { istBezahlbar, kasseOffenFuer, starteZahlung } from '../services/kasse'
import { ApiError } from '../services/api'

const taktText: Record<Plan['takt'], string> = {
  gratis: 'dauerhaft gratis',
  monatlich: 'pro Monat',
  jährlich: 'pro Jahr',
  einmalig: 'einmalig',
}

/**
 * Die Tarifwahl nach der ersten Anmeldung.
 *
 * Sie erscheint genau einmal. Wer nichts wählt, bleibt im Gratistarif – der
 * Dienst funktioniert damit vollständig, und ein Fenster, das sich erst
 * schliessen lässt, wenn jemand zahlt, wäre kein Angebot, sondern eine
 * Schranke.
 *
 * Bezahlt wird hier nichts: Der Browser kann keinen bezahlten Zugang
 * freischalten. Aus einer Auswahl wird deshalb ein Wunsch, den die
 * Moderation sieht – und das steht auch so da.
 */
export function TarifDialog() {
  const user = useSession((s) => s.user)
  const kasseOffen = kasseOffenFuer(user)
  const aktionen = useAktionen((s) => s.aktionen)
  const gutschein = useAktionen((s) => s.gutschein)
  const gratisBis = gratisZeitBis({ aktionen })
  const rabattVon = (plan: PlanId) => rabattFuer({ aktionen, gutschein }, plan)
  const ready = useSession((s) => s.ready)
  const loading = useSession((s) => s.loading)
  const busy = useSession((s) => s.busy)
  const choosePlan = useSession((s) => s.choosePlan)

  const [auswahl, setAuswahl] = useState<PlanId>('frei')
  const [bestaetigt, setBestaetigt] = useState<PlanId | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [zahlungLaeuft, setZahlungLaeuft] = useState(false)

  /**
   * Einmal aufgegangen, bleibt das Fenster offen, bis jemand es schliesst.
   *
   * Die Sichtbarkeit hängt bewusst nicht am Konto: Die Auswahl setzt
   * `planChosen`, und ein daran hängendes Fenster würde sich in derselben
   * Sekunde schliessen, in der die Bestätigung erscheinen soll. Stattdessen
   * wird der Anlass einmal festgehalten – eine Zustandsanpassung während des
   * Renderns, nicht in einem Effekt.
   */
  const [aufgegangen, setAufgegangen] = useState(false)
  const [abgeschlossen, setAbgeschlossen] = useState(false)

  // Wer den Dienst betreibt, bekommt kein Tarifangebot – er hat ohnehin
  // keine Grenzen, und die Frage wäre nur im Weg.
  // Erst nach der Pflichtangabe: Zwei Fenster übereinander wären eine Wand.
  const anlass =
    ready && !loading && Boolean(user) && Boolean(user?.geschlecht) && !user?.planChosen && user?.rolle === 'nutzer'
  if (anlass && !aufgegangen && !abgeschlossen) setAufgegangen(true)

  const sichtbar = aufgegangen && !abgeschlossen

  /**
   * Einmal gesehen, nie wieder.
   *
   * "Später entscheiden" hält das auch fest – sonst ginge das Fenster bei
   * jedem Seitenaufruf neu auf, und aus einem Angebot würde Nörgeln. Wer
   * nichts wählt, bleibt im Gratistarif; das steht so im Fenster, und
   * wechseln lässt es sich jederzeit unter "Tarife".
   */
  const schliessen = () => {
    setAbgeschlossen(true)
    if (bestaetigt === null) void choosePlan('frei')
  }

  const waehlen = async () => {
    setFehler(null)
    if (kasseOffen && istBezahlbar(auswahl)) {
      setZahlungLaeuft(true)
      try {
        // Ab hier verlässt die Seite den Browser Richtung Stripe.
        await starteZahlung(auswahl, rabattVon(auswahl)?.aktion.code ?? null)
      } catch (error) {
        setFehler(error instanceof ApiError ? error.message : 'Die Zahlung konnte nicht gestartet werden.')
        setZahlungLaeuft(false)
      }
      return
    }
    const ok = await choosePlan(auswahl, rabattVon(auswahl)?.aktion.code ?? null)
    if (ok) setBestaetigt(auswahl)
    else setFehler('Die Auswahl konnte nicht gespeichert werden. Du kannst sie später unter „Tarife" treffen.')
  }

  const bezahlt = bestaetigt !== null && bestaetigt !== 'frei'

  const titel =
    bestaetigt === null
      ? 'Womit möchtest du starten?'
      : bezahlt
        ? 'Notiert – und ehrlich gesagt'
        : 'Gratis eingerichtet'

  const beschreibung =
    bestaetigt === null
      ? 'Sicherheit, Verifizierung und Moderation sind überall gleich. Die Wahl betrifft nur, wie viel und wie gezielt du chattest.'
      : bezahlt
        ? 'Bezahlen lässt sich hier noch nicht.'
        : 'Du kannst sofort loslegen.'

  return (
    <Dialog open={sichtbar} onClose={schliessen} title={titel} description={beschreibung}>
      {bestaetigt === null ? (
        <>
          {gratisBis ? (
            <Note>
              <strong>Aktion:</strong> Bis und mit {datumKurz(gratisBis)} hast du alle Plus-Funktionen gratis – dafür
              musst du nichts wählen.
            </Note>
          ) : null}
          <fieldset className="flex flex-col gap-2 border-0 p-0">
            <legend className="sr-only">Tarif wählen</legend>
            {PLAENE.map((plan) => (
              <label
                key={plan.id}
                className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors ${
                  auswahl === plan.id ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name="tarif"
                  value={plan.id}
                  checked={auswahl === plan.id}
                  onChange={() => setAuswahl(plan.id)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{plan.name}</span>
                    {rabattVon(plan.id) && plan.preisRappen > 0 ? (
                      <>
                        <span className="font-mono text-sm">
                          {rappenText(rabattiert(plan.preisRappen, rabattVon(plan.id)!.prozent))}
                        </span>
                        <span className="sr-only">statt</span>
                        <s className="font-mono text-xs text-muted">{preisText(plan)}</s>
                      </>
                    ) : (
                      <span className="font-mono text-sm">{preisText(plan)}</span>
                    )}
                    <span className="text-xs text-muted">{taktText[plan.takt]}</span>
                    {plan.empfohlen ? <span className="label-caps text-accent-strong">Beliebt</span> : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{plan.kurz}</span>
                  {(() => {
                    const rabatt = rabattVon(plan.id)
                    const dauer = rabatt ? dauerText(rabatt.aktion, plan.id) : null
                    if (!rabatt || !dauer || rabatt.aktion.aboDauer === 'dauerhaft') return null
                    return (
                      <span className="mt-0.5 block text-xs text-accent-strong">
                        −{rabatt.prozent} % {dauer}, danach {preisText(plan)}
                      </span>
                    )
                  })()}
                </span>
              </label>
            ))}
          </fieldset>

          {auswahl === 'frei' ? null : kasseOffen ? (
            <p className="text-sm text-muted">
              Weiter geht es bei Stripe – Karte, TWINT, Apple Pay und Google Pay. Danach kommst du hierher zurück.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Bezahlen lässt sich hier noch nicht – das braucht einen Server, der die Quittung prüft. Deine Auswahl
              geht als Wunsch an die Moderation, die den Zugang von Hand freischaltet.
            </p>
          )}

          {fehler ? <Note tone="warn">{fehler}</Note> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="primary" disabled={busy || zahlungLaeuft} onClick={() => void waehlen()}>
              {zahlungLaeuft
                ? 'Weiter zur Kasse …'
                : auswahl === 'frei'
                  ? 'Gratis starten'
                  : kasseOffen
                    ? 'Zur Bezahlung'
                    : 'Auswählen'}
            </Button>
            <Button type="button" variant="quiet" disabled={busy} onClick={schliessen}>
              Später entscheiden
            </Button>
            <Link to="/preise" onClick={schliessen} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
              Alle Unterschiede
            </Link>
          </div>
        </>
      ) : bezahlt ? (
        <>
          <p className="text-muted">
            Dein Wunsch liegt bei der Moderation. Freigeschaltet wird er von Hand, sobald die Zahlung eingerichtet ist
            – wir melden uns dann bei dir. Bis dahin kannst du den Dienst im Gratistarif vollständig nutzen: zehn
            Chats pro Tag, dieselbe Verifizierung, dieselbe Moderation.
          </p>
          <div>
            <Button type="button" variant="primary" onClick={schliessen}>
              Weiter zum Dienst
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted">
            Zehn Chats pro Tag, Suche nach deiner Sprache. Wechseln kannst du jederzeit unter „Tarife" – dein Zugang
            zum Dienst wird nicht beeinträchtigt.
          </p>
          <div>
            <Button type="button" variant="primary" onClick={schliessen}>
              Los geht&rsquo;s
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
