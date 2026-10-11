import type { CSSProperties } from 'react'

/**
 * Ein Lichtstrahl, der den Rand einer Karte umrundet – nach Magic UI
 * `border-beam` (MIT), mit CSS `offset-path` statt `motion`.
 *
 * Das Elternelement braucht `relative` und einen Radius. Browser ohne
 * `offset-path: rect()` zeigen einfach keinen Strahl.
 */
export function BorderBeam({
  size = 90,
  duration = 8,
  delay = 0,
  breite = 1,
}: {
  size?: number
  duration?: number
  delay?: number
  breite?: number
}) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--beam-breite) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={{ '--beam-breite': `${breite}px` } as CSSProperties}
    >
      <span
        className="absolute aspect-square animate-border-beam bg-linear-to-l from-accent-bright via-accent to-transparent"
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            '--beam-duration': `${duration}s`,
            animationDelay: `-${delay}s`,
          } as CSSProperties
        }
      />
    </span>
  )
}
