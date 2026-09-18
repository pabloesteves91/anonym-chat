import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Kleines UI-Kit. Alle Farben kommen aus den Tokens in styles/index.css –
 * hier stehen keine Hex-Werte.
 */

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink border border-accent hover:opacity-90',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-raised',
  quiet: 'bg-transparent text-muted border border-transparent hover:text-ink hover:bg-raised',
  danger: 'bg-transparent text-signal border border-signal/50 hover:bg-signal-soft',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonProps) {
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5'
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${sizing} ${VARIANTS[variant]} ${className}`}
    />
  )
}

export function Panel({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside'
}) {
  return <Tag className={`rounded-sm border border-line bg-surface ${className}`}>{children}</Tag>
}

export function PageTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <header className="mb-6">
      {kicker ? <p className="label-caps mb-2">{kicker}</p> : null}
      <h1 className="font-display text-3xl leading-tight font-semibold text-balance sm:text-4xl">{children}</h1>
    </header>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="label-caps">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  )
}

export const inputClass =
  'w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-ink placeholder:text-muted'

export function TagToggle({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`rounded-[2px] border px-2.5 py-1 text-sm transition-colors ${
        active
          ? 'border-accent bg-accent-soft text-ink'
          : 'border-line-strong bg-surface text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}

export function Note({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' }) {
  const styles =
    tone === 'warn'
      ? 'border-signal/40 bg-signal-soft text-ink'
      : 'border-line bg-raised text-muted'
  return <p className={`rounded-sm border px-3 py-2 text-sm ${styles}`}>{children}</p>
}
