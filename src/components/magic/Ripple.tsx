import type { CSSProperties } from 'react'

/**
 * Ruhige Kreise, die sich ausdehnen – nach Magic UI `ripple` (MIT).
 * Für die Warteschlange: Es wird gesucht, ohne Spinner-Hektik.
 */
export function Ripple({ groesse = 120, anzahl = 5 }: { groesse?: number; anzahl?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
      {Array.from({ length: anzahl }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full border border-accent/40 bg-accent/5 animate-ripple"
          style={
            {
              '--i': i,
              width: groesse + i * 56,
              height: groesse + i * 56,
              opacity: 0.6 - i * 0.1,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) scale(1)',
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
