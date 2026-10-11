# Effekte nach Magic UI

Die Bausteine hier sind nach Komponenten von [Magic UI](https://magicui.design)
gebaut (MIT-Lizenz, © 2023 Magic UI), die auch auf 21st.dev gelistet sind:
`shimmer-button`, `border-beam`, `animated-shiny-text`, `grid-pattern`,
`ripple` und `magic-card`.

Angepasst an NØNE:

- Farben aus unseren Tokens statt fester Werte.
- Reines CSS statt der Bibliothek `motion` – weniger Ladezeit, und
  `prefers-reduced-motion` hält alles an (siehe `src/styles/index.css`).
- Keine Abhängigkeit von `cn()`/`tailwind-merge`: Klassen werden nur
  angehängt.
