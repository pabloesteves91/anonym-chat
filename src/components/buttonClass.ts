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
const GESPERRT =
  'disabled:cursor-not-allowed disabled:border-line disabled:bg-raised disabled:bg-none disabled:text-muted disabled:shadow-none disabled:opacity-100'

/**
 * Primär ist der Knopf mit dem Lichtsaum (siehe `magic/Shimmer.tsx`): Mint-
 * Verlauf, weiches Leuchten, ein Funke läuft am Rand. Die Variablen hier
 * steuern den Funken; `relative isolate overflow-hidden` braucht er als
 * Rahmen. Ohne die Schicht bleibt ein ruhiger Verlaufsknopf.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'group relative isolate overflow-hidden border border-white/25 bg-linear-to-br from-accent-bright to-accent text-accent-ink shadow-glow hover:brightness-[1.04] active:translate-y-px [--cut:0.08em] [--shimmer-color:#ffffff] [--speed:3s] [--spread:90deg]',
  secondary: 'border border-line-strong bg-raised/80 text-ink hover:border-accent/50 hover:bg-raised',
  quiet: 'border border-transparent bg-transparent text-muted hover:bg-raised hover:text-ink',
  danger: 'border border-signal/50 bg-transparent text-signal hover:bg-signal-soft',
}

export function buttonClass(variant: Variant = 'secondary', size: 'sm' | 'md' = 'md', extra = ''): string {
  const sizing = size === 'sm' ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-[0.9375rem]'
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-[color,background-color,border-color,box-shadow,filter,transform] duration-200 ${GESPERRT} ${sizing} ${VARIANTS[variant]} ${extra}`
}
