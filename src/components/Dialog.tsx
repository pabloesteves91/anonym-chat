import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Modal auf Basis des nativen <dialog>-Elements: Fokusfalle, Escape und
 * Inertisierung des Hintergrunds kommen damit von der Plattform.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-3xl border border-line bg-surface p-0 text-ink shadow-[0_32px_80px_-24px_rgb(0_0_0/0.6)] backdrop:bg-black/55 backdrop:backdrop-blur-sm open:animate-[blur-fade_0.3s_ease-out]"
    >
      <div className="flex flex-col gap-4 p-6 sm:p-7">
        <div>
          <h2 id="dialog-title" className="font-display text-2xl font-semibold tracking-[-0.02em]">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {children}
      </div>
    </dialog>
  )
}
