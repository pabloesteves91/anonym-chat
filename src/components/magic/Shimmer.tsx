/**
 * Lichtfunke, der am Rand eines Knopfs entlangläuft – nach Magic UI
 * `shimmer-button` (MIT).
 *
 * Als eigene Schicht, damit derselbe Effekt in einem `<button>` und in
 * einem Link sitzen kann, der wie ein Knopf aussieht. Das Elternelement
 * braucht `relative isolate overflow-hidden` (steckt in
 * `buttonClass('primary')`).
 *
 * Aufbau wie im Original: Der Funke liegt unter einer Fläche, die rundum
 * um `--cut` eingerückt ist. Sichtbar bleibt er nur in diesem schmalen
 * Rand – ein Lichtsaum, kein Glitzern über dem Text.
 */
export function Shimmer() {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-0 -z-30 overflow-visible blur-[2px] @container-[size]">
        <span className="absolute inset-0 aspect-square h-[100cqh] animate-shimmer-slide">
          <span className="absolute -inset-full w-auto animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
        </span>
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-(--cut) -z-20 rounded-[inherit] bg-linear-to-br from-accent-bright to-accent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_-8px_10px_#ffffff1f] transition-shadow duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]"
      />
    </>
  )
}
