import { useId } from 'react'

/**
 * Feines Raster als Hintergrund – nach Magic UI `grid-pattern` (MIT).
 * Ausgeblendet wird es über eine Maske am Element (`className`).
 */
export function GridPattern({ size = 32, className = '' }: { size?: number; className?: string }) {
  const id = useId()
  return (
    <svg aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" x={-1} y={-1}>
          <path d={`M.5 ${size}V.5H${size}`} fill="none" stroke="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  )
}
