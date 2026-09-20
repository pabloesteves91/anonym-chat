import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Note, PageTitle, Panel } from '../components/ui'
import * as api from '../services/mockApi'
import { useAuth } from '../store/useAuth'
import { useSession } from '../store/useSession'

/**
 * Übersicht für Testdurchläufe.
 *
 * Nicht Teil des Produkts: Sie zeigt den aktuellen Stand und lässt direkt in
 * jede Phase springen, damit man nicht bei jedem Durchgang die ganze
 * Verifizierung wiederholen muss. Erreichbar nur über die Fusszeile.
 */
export function TestBoard() {
  const navigate = useNavigate()
  const konto = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)
  const user = useSession((s) => s.user)
  const refreshUser = useSession((s) => s.refreshUser)
  const resetIdentity = useSession((s) => s.resetIdentity)
  const [busy, setBusy] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  useEffect(() => {
    if (konto) void refreshUser()
  }, [konto, refreshUser])

  const status = user?.verificationStatus ?? 'offen'

  const setzeVerifiziert = async (verified: boolean) => {
    setBusy(true)
    try {
      await api.overrideVerificationForTesting(verified)
      await refreshUser()
      setMeldung(verified ? 'Als verifiziert markiert.' : 'Verifizierung zurückgesetzt.')
    } catch {
      setMeldung('Hat nicht geklappt – ist ein Konto angemeldet?')
    }
    setBusy(false)
  }

  const phasen = [
    {
      nr: '01',
      titel: 'Konto',
      stand: konto ? `angemeldet – ${konto.email ?? konto.uid}` : 'nicht angemeldet',
      fertig: Boolean(konto),
      aktion: konto ? (
        <Button size="sm" onClick={() => void signOut()}>
          Abmelden
        </Button>
      ) : (
        <Button size="sm" variant="primary" onClick={() => navigate('/anmelden')}>
          Anmelden
        </Button>
      ),
    },
    {
      nr: '02',
      titel: 'Verifizierung',
      stand: { offen: 'nicht begonnen', wartet: 'eingereicht, wartet', verifiziert: 'freigegeben', abgelehnt: 'abgelehnt' }[
        status
      ],
      fertig: status === 'verifiziert',
      aktion: (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!konto} onClick={() => navigate('/verifizierung')}>
            Öffnen
          </Button>
          {status === 'verifiziert' ? (
            <Button size="sm" variant="danger" disabled={busy} onClick={() => void setzeVerifiziert(false)}>
              Zurücksetzen
            </Button>
          ) : (
            <Button size="sm" variant="primary" disabled={busy || !konto} onClick={() => void setzeVerifiziert(true)}>
              Überspringen
            </Button>
          )}
        </div>
      ),
    },
    {
      nr: '03',
      titel: 'Profil',
      stand: user ? `${user.pseudonym} · ${user.profile.interests.length} Interessen` : '–',
      fertig: Boolean(user?.verified),
      aktion: (
        <Button size="sm" disabled={!user?.verified} onClick={() => navigate('/profil')}>
          Öffnen
        </Button>
      ),
    },
    {
      nr: '04',
      titel: 'Chat',
      stand: user?.verified ? 'bereit' : 'braucht Verifizierung',
      fertig: Boolean(user?.verified),
      aktion: (
        <Button size="sm" variant="primary" disabled={!user?.verified} onClick={() => navigate('/chat')}>
          Starten
        </Button>
      ),
    },
    {
      nr: '05',
      titel: 'Moderation',
      stand: 'eigenes Konto nötig',
      fertig: false,
      aktion: (
        <Button size="sm" onClick={() => navigate('/admin')}>
          Öffnen
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="prose-column">
        <PageTitle kicker="Nur zum Testen">Phasen</PageTitle>
        <p className="text-muted">
          Direkt in jeden Abschnitt springen, ohne den ganzen Weg zu wiederholen. Diese Seite gehört nicht zum
          Produkt und ist nirgends verlinkt ausser in der Fusszeile.
        </p>
      </div>

      <ol className="grid gap-px overflow-hidden rounded-sm border border-line bg-line">
        {phasen.map((phase) => (
          <li key={phase.nr} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface p-4">
            <span className={`font-mono text-xs ${phase.fertig ? 'text-accent' : 'text-muted'}`}>{phase.nr}</span>
            <span className="min-w-[8rem]">
              <span className="block font-medium">{phase.titel}</span>
              <span className="block text-sm text-muted">{phase.stand}</span>
            </span>
            <span className="ml-auto">{phase.aktion}</span>
          </li>
        ))}
      </ol>

      {meldung ? <Note>{meldung}</Note> : null}

      <Panel className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl font-semibold">Zurücksetzen</h2>
        <p className="text-sm text-muted">
          Löscht Pseudonym, Profil, Verifizierung und eigene Blockierungen dieses Kontos. Das Konto selbst bleibt –
          zum Abmelden oben in Phase 01.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            disabled={busy || !konto}
            onClick={async () => {
              setBusy(true)
              await resetIdentity()
              if (konto) await useSession.getState().load(konto.uid)
              setBusy(false)
              setMeldung('Alles für dieses Konto zurückgesetzt.')
            }}
          >
            Daten dieses Kontos löschen
          </Button>
          <Link to="/" className="rounded-sm px-3 py-2.5 text-sm text-muted transition-colors hover:text-ink">
            Zur Startseite
          </Link>
        </div>
      </Panel>
    </div>
  )
}
