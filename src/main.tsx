import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'

// Schriften werden lokal gebündelt – die App darf zur Laufzeit kein CDN
// brauchen. Bei einem Dienst, der mit Datensparsamkeit wirbt, wäre ein Abruf
// bei Google für jede Seite ein Widerspruch.
import '@fontsource-variable/montserrat'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './styles/index.css'

import App from './App'
import { useTheme } from './store/useTheme'

useTheme.getState().init()

// Für statische Auslieferung ohne Server-Rewrites (z.B. die Live-Demo) wird
// mit `--mode static` auf Hash-Routing umgestellt; lokal bleiben saubere Pfade.
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

// Alte Links aus der Zeit mit Hash-Routing (…/#/chat) auf echte Pfade
// umschreiben, bevor der Router startet – geteilte Links bleiben gültig.
if (Router === BrowserRouter && window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
