import { useRef, type PointerEvent, type ReactNode } from 'react'

/**
 * Karte mit einem weichen Lichtkegel unter dem Zeiger – nach Magic UI
 * `magic-card` (MIT), ohne `motion`: Die Position steht in zwei
 * CSS-Variablen. Auf Touch-Geräten bleibt die Karte ruhig.
 */
export function Spotlight({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const bewegen = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--mx', `${event.clientX - r.left}px`)
    ref.current.style.setProperty('--my', `${event.clientY - r.top}px`)
  }
  return (
    <div
      ref={ref}
      onPointerMove={bewegen}
      className={`group/spot relative overflow-hidden ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100 [background:radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,50%),color-mix(in_srgb,var(--accent)_14%,transparent),transparent_70%)]"
      />
      {children}
    </div>
  )
}
