import type { CSSProperties, ReactNode } from 'react'

/**
 * Text, über den ab und zu ein Lichtschimmer läuft – nach Magic UI
 * `animated-shiny-text` (MIT).
 */
export function ShinyText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      style={{ '--shiny-width': '90px' } as CSSProperties}
      className={`animate-shiny-text bg-size-[var(--shiny-width)_100%] bg-clip-text bg-position-[0_0] bg-no-repeat bg-linear-to-r from-transparent via-ink/80 via-50% to-transparent ${className}`}
    >
      {children}
    </span>
  )
}
