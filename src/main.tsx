import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'

// Schriften werden lokal gebündelt – die App darf zur Laufzeit kein CDN brauchen.
import '@fontsource-variable/source-serif-4'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './styles/index.css'

import App from './App'
import { useTheme } from './store/useTheme'

useTheme.getState().init()

// Für statische Auslieferung ohne Server-Rewrites (z.B. die Live-Demo) wird
// mit `--mode static` auf Hash-Routing umgestellt; lokal bleiben saubere Pfade.
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
