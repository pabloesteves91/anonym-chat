import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Note, PageTitle, Panel, inputClass } from '../components/ui'
import { buttonClass } from '../components/buttonClass'
import { GRATIS_CHATS_PRO_TAG, PLAENE, aktiverPlan, preisText, rappenText, type Plan, type PlanId } from '../services/plans'
import { dauerText, datumKurz, hinweis, laufendeAktionen, rabattiert, tarifeText, type Aktion, type Rabatt } from '../services/aktion'
import { AktionsHinweis } from '../components/AktionsHinweis'
import { rabattFuer, useAktionen } from '../store/useAktionen'
import { BETREIBER } from '../content/legal'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'
import { istBezahlbar, kasseOffenFuer, starteZahlung } from '../services/kasse'
import { ApiError } from '../services/api'

const taktText: Record<Plan['takt'], string> = {
  gratis: 'dauerhaft',
  monatlich: 'pro Monat',
  jährlich: 'pro Jahr',
  einmalig: 'einmalig',
}

/** Was sich zwischen den Tarifen tatsächlich unterscheidet. */
const VERGLEICH: { merkmal: string; frei: string; plus: string }[] = [
  { merkmal: 'Chats pro Tag', frei: `${GRATIS_CHATS_PRO_TAG}`, plus: 'unbegrenzt' },
  { merkmal: 'Suche nach Sprache', frei: 'ja', plus: 'ja' },
  { merkmal: 'Suche nach Interessen', frei: '–', plus: 'ja' },
  { merkmal: 'Platz in der Warteschlange', frei: 'normal', plus: 'bevorzugt' },
  { merkmal: 'Anzeigename', frei: 'gewürfelt', plus: 'frei wählbar' },
  { merkmal: 'Verifizierung mit Ausweis', frei: 'ja', plus: 'ja' },
  { merkmal: 'Wortfilter und Warnungen', frei: 'ja', plus: 'ja' },
  { merkmal: 'Melden und Blockieren', frei: 'ja', plus: 'ja' },
  { merkmal: 'Moderation durch Menschen', frei: 'ja', plus: 'ja' },
  { merkmal: 'Verläufe nach 72 Stunden gelöscht', frei: 'ja', plus: 'ja' },
]

const FRAGEN: { frage: string; antwort: string }[] = [
  {
    frage: 'Ist der Gratistarif eine Testphase?',
    antwort:
      'Nein. Er ist dauerhaft und vollständig: dieselbe Verifizierung, dieselbe Moderation, dieselben Meldewege. Begrenzt ist nur die Anzahl Gespräche pro Tag.',
  },
  {
    frage: 'Warum kostet der eigene Anzeigename etwas?',
    antwort:
      'Ein gewürfelter Name macht es schwerer, jemanden über mehrere Chats hinweg wiederzuerkennen – das nützt dem Gratistarif eher, als dass es ihm schadet. Wer den Namen selbst setzt, durchläuft weiterhin die Namensprüfung.',
  },
  {
    frage: 'Was passiert, wenn mein Abo ausläuft?',
    antwort:
      'Dein Konto bleibt, wie es ist – nur die Grenze von zehn Chats pro Tag gilt wieder. Verifizierung, Pseudonym und Profil bleiben unberührt.',
  },
  {
    frage: 'Wie lange gilt Lifetime?',
    antwort:
      'Solange es diesen Dienst gibt. Wird er eingestellt, besteht kein Anspruch auf Rückerstattung – das steht so auch in den Nutzungsbedingungen, damit es niemanden überrascht.',
  },
  {
    frage: 'Bekomme ich mit Plus bevorzugte Behandlung bei einer Meldung?',
    antwort:
      'Nein. Meldungen werden in der Reihenfolge ihres Eingangs geprüft, und eine Sperre trifft ein bezahltes Konto genauso wie ein gratis genutztes. Erstattet wird in dem Fall nichts.',
  },
  {
    frage: 'Wie erreiche ich den Support?',
    antwort: `Mit Konto über die Supportseite, sobald du angemeldet bist: Thema wählen, beschreiben, bei Bedarf Bilder anhängen. Die Moderation antwortet dort, falls nötig in einem Chat. Die Seite steht nur Mitgliedern offen – ohne Konto, oder wenn die Anmeldung nicht klappt, schreib an ${BETREIBER.email}.`,
  },
]

/** Die Frage zu laufenden Aktionen – nur, solange eine läuft. */
function aktionsFragen(laufend: Aktion[]): { frage: string; antwort: string }[] {
  if (!laufend.length) return []
  // Die Fakten, nicht der Werbetext: hier zählt, was genau gilt.
  const saetze = laufend.flatMap((aktion) => hinweis(aktion, Date.now(), false).punkte)
  const schluss =
    'Danach gilt wieder der eigene Tarif – es verlängert sich nichts von selbst. Überschneiden sich Aktionen, gilt pro Tarif der höchste Rabatt; Rabatte werden nicht zusammengezählt.'
  return [{ frage: 'Was gilt während der laufenden Aktion?', antwort: `${saetze.join(' ')} ${schluss}` }]
}

/** Was unter dem rabattierten Preis steht. */
function rabattZeile(plan: Plan, rabatt: Rabatt): string {
  const dauer = dauerText(rabatt.aktion, plan.id)
  const quelle = rabatt.aktion.code ? ` mit Code ${rabatt.aktion.code}` : ''
  if (!dauer) return `−${rabatt.prozent} %${quelle}`
  if (rabatt.aktion.aboDauer === 'dauerhaft') return `−${rabatt.prozent} %${quelle}, ${dauer}`
  return `−${rabatt.prozent} %${quelle} ${dauer}, danach ${preisText(plan)}`
}

function Karte({
  plan,
  aktiv,
  gewaehlt,
  onWaehlen,
  busy,
  laeuft,
  kasseOffen,
  angemeldet,
  rabatt,
}: {
  plan: Plan
  /** Der beste Rabatt aus Aktionen und Gutschein, oder keiner. */
  rabatt: Rabatt | null
  aktiv: boolean
  gewaehlt: boolean
  onWaehlen: () => void
  busy: boolean
  /** Eine Bezahlung ist unterwegs – der Knopf sagt es. */
  laeuft: boolean
  /** Führt „buchen" zur Kasse (sonst: Tarifwunsch)? */
  kasseOffen: boolean
  angemeldet: boolean
}) {
  return (
    <Panel
      as="article"
      className={`flex flex-col gap-4 p-5 ${plan.empfohlen ? 'border-accent/60 ring-1 ring-accent/25' : ''}`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
          {plan.empfohlen ? <span className="label-caps text-accent-strong">Beliebt</span> : null}
          {aktiv ? (
            <span className="rounded-sm border border-accent/45 bg-accent-soft px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-accent-strong uppercase">
              Dein Tarif
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">{plan.kurz}</p>
      </div>

      {rabatt && plan.preisRappen > 0 ? (
        <div>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">
              {rappenText(rabattiert(plan.preisRappen, rabatt.prozent))}
            </span>
            <span className="sr-only">statt</span>
            <s className="text-muted">{preisText(plan)}</s>
            <span className="text-sm text-muted">{taktText[plan.takt]}</span>
          </p>
          <p className="mt-1 text-sm font-medium text-accent-strong">{rabattZeile(plan, rabatt)}</p>
          <p className="text-xs text-muted">Bis und mit {datumKurz(rabatt.bis)}</p>
        </div>
      ) : (
        <p className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold">{preisText(plan)}</span>
          <span className="text-sm text-muted">{taktText[plan.takt]}</span>
        </p>
      )}

      <ul className="flex flex-col gap-1.5 text-sm">
        {plan.vorteile.map((vorteil) => (
          <li key={vorteil} className="flex gap-2">
            <span aria-hidden="true" className="text-accent-strong">
              ·
            </span>
            {vorteil}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        {!angemeldet ? (
          <Link to="/anmelden" className={buttonClass(plan.empfohlen ? 'primary' : 'secondary', 'sm')}>
            Konto anlegen
          </Link>
        ) : aktiv ? (
          <p className="text-sm text-muted">Läuft bereits.</p>
        ) : gewaehlt ? (
          <p className="text-sm text-accent-strong">Wunsch ist notiert.</p>
        ) : (
          <Button size="sm" variant={plan.empfohlen ? 'primary' : 'secondary'} disabled={busy} onClick={onWaehlen}>
            {laeuft
              ? 'Weiter zur Kasse …'
              : plan.id === 'frei'
                ? 'Gratis nutzen'
                : kasseOffen
                  ? `Für ${rappenText(rabatt ? rabattiert(plan.preisRappen, rabatt.prozent) : plan.preisRappen)} buchen`
                  : 'Diesen Tarif möchte ich'}
          </Button>
        )}
      </div>
    </Panel>
  )
}

/** Tarifübersicht. Gebucht wird noch nicht hier – siehe Hinweis unten. */
/** Einen Gutscheincode einlösen – oder den eingelösten wieder entfernen. */
function GutscheinFeld() {
  const gutschein = useAktionen((s) => s.gutschein)
  const fehler = useAktionen((s) => s.gutscheinFehler)
  const prueft = useAktionen((s) => s.gutscheinPrueft)
  const einloesen = useAktionen((s) => s.einloesen)
  const entfernen = useAktionen((s) => s.entfernen)
  const [eingabe, setEingabe] = useState('')

  if (gutschein) {
    return (
      <div className="prose-column flex flex-wrap items-center gap-3 rounded-sm border border-accent/45 bg-accent-soft px-4 py-3 text-sm">
        <span>
          Code <strong className="font-mono">{gutschein.code}</strong> eingelöst: −{gutschein.rabattProzent} % auf{' '}
          {tarifeText(gutschein.tarife)}. Gilt ein anderer Rabatt höher, zählt der höhere.
        </span>
        <Button size="sm" variant="quiet" onClick={entfernen}>
          Entfernen
        </Button>
      </div>
    )
  }
  return (
    <form
      className="prose-column flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void einloesen(eingabe).then((ok) => ok && setEingabe(''))
      }}
    >
      <label htmlFor="gutschein" className="text-sm font-medium">
        Gutscheincode
      </label>
      <div className="flex gap-2">
        <input
          id="gutschein"
          className={`${inputClass} max-w-xs font-mono uppercase`}
          value={eingabe}
          onChange={(event) => setEingabe(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
        />
        <Button type="submit" size="sm" disabled={prueft || !eingabe.trim()}>
          {prueft ? 'Prüft …' : 'Einlösen'}
        </Button>
      </div>
      {fehler ? <Note tone="warn">{fehler}</Note> : null}
    </form>
  )
}

export function Preise() {
  const konto = useAuth((s) => s.user)
  const user = useSession((s) => s.user)
  const kasseOffen = kasseOffenFuer(user)
  const busy = useSession((s) => s.busy)
  const choosePlan = useSession((s) => s.choosePlan)
  const [gewaehlt, setGewaehlt] = useState<PlanId | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  // Der Weg zur Kasse führt über den Server und kann einen Moment dauern –
  // ein Knopf, der nichts tut, sieht aus wie ein kaputter Knopf.
  const [zahlungLaeuft, setZahlungLaeuft] = useState(false)
  const [parameter] = useSearchParams()
  const zahlung = parameter.get('zahlung')

  const aktionen = useAktionen((s) => s.aktionen)
  const gutschein = useAktionen((s) => s.gutschein)
  const laufend = laufendeAktionen(gutschein ? [...aktionen, gutschein] : aktionen)
  const meiner = aktiverPlan(user?.membership)
  const imBetrieb = Boolean(user && user.rolle !== 'nutzer')

  // Ein Link wie /preise?code=SOMMER25 löst den Code gleich ein.
  const einloesen = useAktionen((s) => s.einloesen)
  const codeImLink = parameter.get('code')
  useEffect(() => {
    if (codeImLink) void einloesen(codeImLink)
  }, [codeImLink, einloesen])

  /** Der Code geht nur mit, wenn er für diesen Tarif den besten Rabatt gibt. */
  const codeFuer = (plan: PlanId) => rabattFuer({ aktionen, gutschein }, plan)?.aktion.code ?? null

  const waehlen = async (plan: PlanId) => {
    setFehler(null)
    if (kasseOffen && istBezahlbar(plan)) {
      setZahlungLaeuft(true)
      try {
        // Ab hier verlässt die Seite den Browser Richtung Stripe.
        await starteZahlung(plan, codeFuer(plan))
      } catch (error) {
        setFehler(error instanceof ApiError ? error.message : 'Die Zahlung konnte nicht gestartet werden.')
        setZahlungLaeuft(false)
      }
      return
    }
    const ok = await choosePlan(plan, codeFuer(plan))
    if (ok) setGewaehlt(plan)
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="prose-column">
        <PageTitle kicker="Tarife">Gratis nutzbar, bezahlt bequemer</PageTitle>
        <p className="text-muted">
          Verifizierung, Moderation und Meldewege sind in jedem Tarif gleich – daran wird nicht gespart, das ist der
          Dienst. Bezahlt wird für mehr Gespräche und gezielteres Suchen, nicht für mehr Sicherheit.
        </p>
      </div>

      {zahlung === 'erfolgreich' ? (
        <Note>
          Danke – die Zahlung ist bei Stripe eingegangen. Der Zugang wird freigeschaltet, sobald die Bestätigung bei
          uns ankommt; das dauert in der Regel Sekunden. Steht dein Tarif gleich noch nicht hier, lade die Seite neu.
        </Note>
      ) : null}
      {zahlung === 'abgebrochen' ? <Note tone="warn">Die Zahlung wurde abgebrochen. Es wurde nichts belastet.</Note> : null}
      {fehler ? <Note tone="warn">{fehler}</Note> : null}

      <AktionsHinweis />

      {imBetrieb ? (
        <Note>
          Dein Konto betreibt den Dienst und hat keine Tarifgrenzen. Die Übersicht bleibt hier, damit du siehst, was
          anderen angeboten wird.
        </Note>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {PLAENE.map((plan) => (
          <Karte
            key={plan.id}
            plan={plan}
            aktiv={plan.id === meiner}
            gewaehlt={gewaehlt === plan.id}
            // Die Verwaltung braucht keinen Tarif – ausser zum Testen der Kasse.
            busy={busy || (imBetrieb && !kasseOffen) || zahlungLaeuft}
            laeuft={zahlungLaeuft}
            kasseOffen={kasseOffen}
            angemeldet={Boolean(konto)}
            rabatt={rabattFuer({ aktionen, gutschein }, plan.id)}
            onWaehlen={() => void waehlen(plan.id)}
          />
        ))}
      </div>

      <GutscheinFeld />

      <section aria-labelledby="vergleich">
        <h2 id="vergleich" className="font-display text-2xl font-semibold">
          Was sich unterscheidet – und was nicht
        </h2>
        <p className="mt-2 max-w-prose text-muted">
          Die untere Hälfte dieser Tabelle ist der eigentliche Punkt: Sicherheit gibt es nicht gegen Aufpreis.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">Vergleich von Gratistarif und Plus</caption>
            <thead>
              <tr className="border-b border-line-strong text-left">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Merkmal
                </th>
                <th scope="col" className="w-28 py-2 pr-4 font-medium">
                  Frei
                </th>
                <th scope="col" className="w-32 py-2 font-medium text-accent-strong">
                  Plus
                </th>
              </tr>
            </thead>
            <tbody>
              {VERGLEICH.map((zeile) => (
                <tr key={zeile.merkmal} className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    {zeile.merkmal}
                  </th>
                  <td className="py-2 pr-4 text-muted">{zeile.frei}</td>
                  <td className="py-2">{zeile.plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="fragen" className="prose-column">
        <h2 id="fragen" className="font-display text-2xl font-semibold">
          Häufige Fragen
        </h2>
        <dl className="mt-5 flex flex-col gap-5">
          {[...aktionsFragen(laufend), ...FRAGEN].map((eintrag) => (
            <div key={eintrag.frage}>
              <dt className="font-medium">{eintrag.frage}</dt>
              <dd className="mt-1 text-muted">{eintrag.antwort}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="prose-column flex flex-col gap-4">
        {kasseOffen ? (
          <Note>
            Bezahlt wird über Stripe – Karte, TWINT, Apple Pay und Google Pay. Wir sehen deine Zahlungsdaten nie; sie
            liegen beim Zahlungsanbieter. Fragen zu einer Zahlung über die Supportseite oder an <span className="font-mono">{BETREIBER.email}</span>.
          </Note>
        ) : (
          <Note tone="warn">
            <strong>Die Kasse fehlt noch.</strong> Zahlen lässt sich hier im Moment nicht: Eine Bezahlung braucht
            einen Server, der die Quittung des Zahlungsanbieters prüft – ein Browser darf über einen bezahlten Zugang
            nicht selbst entscheiden. Wer oben einen bezahlten Tarif wählt, hinterlässt deshalb einen Wunsch;
            freigeschaltet wird er von Hand. Fragen dazu über die Supportseite oder an <span className="font-mono">{BETREIBER.email}</span>.
          </Note>
        )}

        <div className="flex flex-wrap gap-3">
          <Link to={konto ? '/chat' : '/anmelden'} className={buttonClass('primary')}>
            {konto ? 'Zum Chat' : 'Gratis starten'}
          </Link>
          <Link to="/agb" className={buttonClass('quiet')}>
            Nutzungsbedingungen
          </Link>
        </div>

        <p className="text-sm text-muted">
          Alle Preise in Schweizer Franken. Abos verlängern sich automatisch und lassen sich jederzeit auf das Ende der
          Laufzeit kündigen. Der Lifetime-Zugang gilt, solange es diesen Dienst gibt.
        </p>
      </div>
    </div>
  )
}
