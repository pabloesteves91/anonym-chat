import { Admin } from './Admin'
import { NotFound } from './NotFound'
import { evaluateAccess } from '../services/auth'
import { useAuth } from '../store/useAuth'

/**
 * Moderationsbereich, inklusive Zugangsprüfung.
 *
 * Wer keine Rechte hat, sieht nicht etwa eine Anmeldemaske, sondern
 * dieselbe Seite wie bei einer Adresse, die es nicht gibt. Eine Maske
 * würde verraten, dass es hier etwas zu holen gibt, und lädt zum Probieren
 * ein; eine fehlende Seite sagt gar nichts.
 *
 * Das ist Verschleierung, keine Sicherung – die leistet allein
 * `firestore.rules`. Angemeldet wird über die gewöhnliche Anmeldung; wer
 * die Rechte hat, findet danach den Menüpunkt.
 */
export default function AdminArea() {
  const ready = useAuth((s) => s.ready)
  const konto = useAuth((s) => s.user)

  // Bis die Anmeldung feststeht, nichts zeigen: Ein kurz aufblitzendes
  // "Seite nicht gefunden" wäre für Berechtigte nur verwirrend.
  if (!ready) {
    return (
      <p className="label-caps" role="status">
        Einen Moment …
      </p>
    )
  }

  const zugang = evaluateAccess(konto ? { uid: konto.uid, email: konto.email } : null)
  if (!zugang.erlaubt) return <NotFound />

  return <Admin rolle={zugang.rolle} email={konto?.email ?? null} />
}
