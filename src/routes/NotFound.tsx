import { Link } from 'react-router-dom'
import { PageTitle } from '../components/ui'
import { buttonClass } from '../components/buttonClass'

export function NotFound() {
  return (
    <div>
      <PageTitle kicker="Fehler 404">Diese Seite gibt es nicht</PageTitle>
      <Link to="/" className={buttonClass('secondary')}>
        Zurück zum Start
      </Link>
    </div>
  )
}
