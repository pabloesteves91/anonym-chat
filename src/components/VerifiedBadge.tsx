import type { VerificationStatus } from '../services/types'

export function ShieldMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor">
      <path d="M12 3l7 2.6v5.2c0 4.2-2.8 7.4-7 9.2-4.2-1.8-7-5-7-9.2V5.6L12 3z" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.8 12.2l2.3 2.3 4.1-4.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TEXT: Record<VerificationStatus, string> = {
  offen: 'Nicht verifiziert',
  wartet: 'In Prüfung',
  verifiziert: 'Verifiziert',
  abgelehnt: 'Abgelehnt',
}

const STIL: Record<VerificationStatus, string> = {
  offen: 'border-line-strong bg-raised text-muted',
  wartet: 'border-line-strong bg-raised text-ink',
  verifiziert: 'border-accent/45 bg-accent-soft text-accent-strong',
  abgelehnt: 'border-signal/45 bg-signal-soft text-signal',
}

/**
 * Das Siegel. Sichtbar, aber nüchtern – es ist ein Statusvermerk,
 * keine Auszeichnung.
 */
export function VerifiedBadge({
  status,
  size = 'md',
}: {
  status: VerificationStatus
  size?: 'sm' | 'md'
}) {
  const sizing = size === 'sm' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-2.5 py-1 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border font-mono tracking-wide uppercase ${sizing} ${STIL[status]}`}
    >
      <ShieldMark className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {TEXT[status]}
    </span>
  )
}
