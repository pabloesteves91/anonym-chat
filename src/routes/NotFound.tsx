import { Link } from 'react-router-dom'
import { PageTitle } from '../components/ui'

export function NotFound() {
  return (
    <div>
      <PageTitle kicker="Fehler 404">Diese Seite gibt es nicht</PageTitle>
      <Link to="/" className="text-accent underline underline-offset-4">
        Zurück zum Start
      </Link>
    </div>
  )
}
