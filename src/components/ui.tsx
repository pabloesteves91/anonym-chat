import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClass, type Variant } from './buttonClass'
import { Shimmer } from './magic/Shimmer'
import { BorderBeam } from './magic/BorderBeam'

/**
 * Kleines UI-Kit. Alle Farben kommen aus den Tokens in styles/index.css –
 * hier stehen keine Hex-Werte.
 */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button {...props} className={buttonClass(variant, size, className)}>
      {variant === 'primary' && !props.disabled ? <Shimmer /> : null}
      {children}
    </button>
  )
}

/**
 * Karte. `hervorgehoben` setzt den umlaufenden Lichtstrahl (Magic UI
 * `border-beam`) und ein leichtes Leuchten – für das, was zählt: den
 * empfohlenen Tarif, den Aufruf zum Start, den laufenden Chat.
 */
export function Panel({
  children,
  className = '',
  as: Tag = 'section',
  hervorgehoben = false,
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside'
  hervorgehoben?: boolean
}) {
  return (
    <Tag
      className={`relative rounded-2xl border bg-surface shadow-karte ${
        hervorgehoben ? 'border-accent/35 shadow-glow' : 'border-line'
      } ${className}`}
    >
      {hervorgehoben ? <BorderBeam /> : null}
      {children}
    </Tag>
  )
}

export function PageTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <header className="mb-6">
      {kicker ? <p className="label-caps mb-3 text-accent-strong">{kicker}</p> : null}
      <h1 className="font-display text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
        {children}
      </h1>
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
  'w-full rounded-xl border border-line-strong bg-raised/60 px-4 py-3 text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-200 hover:border-accent/40 focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_25%,transparent)] focus:outline-none'

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
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-accent bg-accent-soft text-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_12%,transparent)]'
          : 'border-line-strong bg-surface text-muted hover:border-accent/40 hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}

export function Note({
  children,
  tone = 'neutral',
  className = '',
  as: Tag = 'p',
}: {
  children: ReactNode
  tone?: 'neutral' | 'warn'
  className?: string
  /** `div`, sobald der Hinweis selbst Absätze oder Listen enthält – in
   *  einem `<p>` wäre das ungültiges Markup. */
  as?: 'p' | 'div'
}) {
  const styles =
    tone === 'warn'
      ? 'border-signal/40 bg-signal-soft text-ink'
      : 'border-line bg-raised/70 text-muted'
  return <Tag className={`rounded-xl border px-4 py-3 text-sm ${styles} ${className}`}>{children}</Tag>
}
