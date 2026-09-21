import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Note, PageTitle, Panel } from '../components/ui'
import { buttonClass } from '../components/buttonClass'
import { GRATIS_CHATS_PRO_TAG, PLAENE, aktiverPlan, preisText, type Plan, type PlanId } from '../services/plans'
import { BETREIBER } from '../content/legal'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'

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
]

function Karte({
  plan,
  aktiv,
  gewaehlt,
  onWaehlen,
  busy,
  angemeldet,
}: {
  plan: Plan
  aktiv: boolean
  gewaehlt: boolean
  onWaehlen: () => void
  busy: boolean
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
          {plan.empfohlen ? <span className="label-caps text-accent">Beliebt</span> : null}
          {aktiv ? (
            <span className="rounded-[2px] border border-accent/45 bg-accent-soft px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-accent uppercase">
              Dein Tarif
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">{plan.kurz}</p>
      </div>

      <p className="flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold">{preisText(plan)}</span>
        <span className="text-sm text-muted">{taktText[plan.takt]}</span>
      </p>

      <ul className="flex flex-col gap-1.5 text-sm">
        {plan.vorteile.map((vorteil) => (
          <li key={vorteil} className="flex gap-2">
            <span aria-hidden="true" className="text-accent">
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
          <p className="text-sm text-accent">Wunsch ist notiert.</p>
        ) : (
          <Button size="sm" variant={plan.empfohlen ? 'primary' : 'secondary'} disabled={busy} onClick={onWaehlen}>
            {plan.id === 'frei' ? 'Gratis nutzen' : 'Diesen Tarif möchte ich'}
          </Button>
        )}
      </div>
    </Panel>
  )
}

/** Tarifübersicht. Gebucht wird noch nicht hier – siehe Hinweis unten. */
export function Preise() {
  const konto = useAuth((s) => s.user)
  const user = useSession((s) => s.user)
  const busy = useSession((s) => s.busy)
  const choosePlan = useSession((s) => s.choosePlan)
  const [gewaehlt, setGewaehlt] = useState<PlanId | null>(null)

  const meiner = aktiverPlan(user?.membership)
  const imBetrieb = Boolean(user && user.rolle !== 'nutzer')

  const waehlen = async (plan: PlanId) => {
    const ok = await choosePlan(plan)
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
            busy={busy || imBetrieb}
            angemeldet={Boolean(konto)}
            onWaehlen={() => void waehlen(plan.id)}
          />
        ))}
      </div>

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
                <th scope="col" className="w-32 py-2 font-medium text-accent">
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
          {FRAGEN.map((eintrag) => (
            <div key={eintrag.frage}>
              <dt className="font-medium">{eintrag.frage}</dt>
              <dd className="mt-1 text-muted">{eintrag.antwort}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="prose-column flex flex-col gap-4">
        <Note tone="warn">
          <strong>Die Kasse fehlt noch.</strong> Zahlen lässt sich hier im Moment nicht: Eine Bezahlung braucht einen
          Server, der die Quittung des Zahlungsanbieters prüft – ein Browser darf über einen bezahlten Zugang nicht
          selbst entscheiden. Wer oben einen bezahlten Tarif wählt, hinterlässt deshalb einen Wunsch; freigeschaltet
          wird er von Hand. Fragen dazu an <span className="font-mono">{BETREIBER.email}</span>.
        </Note>

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
