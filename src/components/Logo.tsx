import logoZeichen from '../assets/logo.png'
import logoSchriftzug from '../assets/logo-text.png'

/**
 * Die Marke.
 *
 * Die Dateien werden importiert statt als `/logo.png` verlinkt: Der
 * ausgelieferte Build läuft mit `--base ./` und Hash-Routing, ein absoluter
 * Pfad würde dort ins Leere zeigen. Über den Import setzt Vite die richtige
 * Adresse ein – hier und unter `…github.io/anonym-chat/` gleichermassen.
 *
 * Beide Dateien sind freigestelltes Mint, also ohne weissen Kasten. Damit
 * tragen sie auf hellem wie auf dunklem Grund.
 */

/** Nur das Zeichen – für Symbolplätze, in denen kein Text daneben passt. */
export function Zeichen({ className = 'h-5 w-auto' }: { className?: string }) {
  return <img src={logoZeichen} alt="" aria-hidden="true" className={className} />
}

/**
 * Zeichen und Schriftzug nebeneinander.
 *
 * Der Name steht zusätzlich als unsichtbarer Text da: Bildschirmleser sollen
 * "NØNE" hören, nicht einen Dateinamen. Am Bild selbst steht deshalb ein
 * leeres `alt`.
 */
export function Wortmarke({ className = 'h-5' }: { className?: string }) {
  return (
    <span className="flex items-center gap-2">
      <img src={logoSchriftzug} alt="" aria-hidden="true" className={`${className} w-auto`} />
      <span className="sr-only">NØNE</span>
    </span>
  )
}
