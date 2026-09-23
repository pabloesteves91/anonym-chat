/**
 * Dieselbe Gestalt für Knopf und Verweis.
 *
 * Ein Verweis, der wie ein Knopf aussieht, muss trotzdem ein `<a>` bleiben –
 * sonst verliert er Mittelklick, Kontextmenü und die Ansage als Link. Die
 * Klassen stehen deshalb hier und nicht in `ui.tsx`: so kommt eine Datei mit
 * Komponenten ohne Zweitexport aus.
 */

export type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'

/**
 * Der gesperrte Zustand ist eine eigene Farbe, keine halbe Deckkraft.
 *
 * Mint trägt dunkle Schrift; auf 45 % heruntergeblendet verschwinden beide
 * ineinander und der Knopf ist nicht mehr zu lesen. Ein neutraler Grund sagt
 * dasselbe – hier geht gerade nichts – und bleibt lesbar.
 */
const GESPERRT = 'disabled:cursor-not-allowed disabled:border-line disabled:bg-raised disabled:text-muted disabled:opacity-100'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink border border-accent hover:opacity-90',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-raised',
  quiet: 'bg-transparent text-muted border border-transparent hover:text-ink hover:bg-raised',
  danger: 'bg-transparent text-signal border border-signal/50 hover:bg-signal-soft',
}

export function buttonClass(variant: Variant = 'secondary', size: 'sm' | 'md' = 'md', extra = ''): string {
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5'
  return `inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors ${GESPERRT} ${sizing} ${VARIANTS[variant]} ${extra}`
}
