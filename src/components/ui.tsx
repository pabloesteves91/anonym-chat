import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClass, type Variant } from './buttonClass'

/**
 * Kleines UI-Kit. Alle Farben kommen aus den Tokens in styles/index.css –
 * hier stehen keine Hex-Werte.
 */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonProps) {
  return <button {...props} className={buttonClass(variant, size, className)} />
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
