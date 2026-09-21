import { Link } from 'react-router-dom'
import { Note, PageTitle, Panel } from '../components/ui'
import { buttonClass } from '../components/buttonClass'
import { PLAENE, aktiverPlan, preisText, type Plan } from '../services/plans'
import { BETREIBER } from '../content/legal'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'

const taktText: Record<Plan['takt'], string> = {
  gratis: 'dauerhaft',
  monatlich: 'pro Monat',
  jährlich: 'pro Jahr',
  einmalig: 'einmalig',
}

function Karte({ plan, aktiv }: { plan: Plan; aktiv: boolean }) {
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
            <span className="rounded-[2px] border border-line-strong bg-raised px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-muted uppercase">
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
    </Panel>
  )
}

/** Preisübersicht. Gebucht wird noch nicht hier – siehe Hinweis unten. */
export function Preise() {
  const konto = useAuth((s) => s.user)
  const user = useSession((s) => s.user)
  const meiner = aktiverPlan(user?.membership)

  return (
    <div className="flex flex-col gap-8">
      <div className="prose-column">
        <PageTitle kicker="Tarife">Gratis nutzbar, bezahlt bequemer</PageTitle>
        <p className="text-muted">
          Verifizierung, Moderation und Meldewege sind in jedem Tarif gleich – daran wird nicht gespart, das ist der
          Dienst. Bezahlt wird für mehr Gespräche und gezielteres Suchen, nicht für mehr Sicherheit.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLAENE.map((plan) => (
          <Karte key={plan.id} plan={plan} aktiv={plan.id === meiner} />
        ))}
      </div>

      <div className="prose-column flex flex-col gap-4">
        <Note tone="warn">
          <strong>Die Kasse fehlt noch.</strong> Zahlen lässt sich hier im Moment nicht: Eine Bezahlung braucht einen
          Server, der die Quittung des Zahlungsanbieters prüft – ein Browser darf über einen bezahlten Zugang nicht
          selbst entscheiden. Bis dahin trägt die Moderation einen Tarif von Hand ein. Wer jetzt schon Plus möchte,
          schreibt an <span className="font-mono">{BETREIBER.email}</span>.
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
