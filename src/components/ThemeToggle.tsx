import { useTheme } from '../store/useTheme'

export function ThemeToggle() {
  const toggle = useTheme((s) => s.toggle)
  const choice = useTheme((s) => s.choice)

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Darstellung: ${choice === 'system' ? 'Systemvorgabe' : choice === 'dark' ? 'dunkel' : 'hell'}`}
      aria-label="Helle oder dunkle Darstellung wechseln"
      className="rounded-sm border border-line-strong bg-surface p-1.5 text-muted transition-colors hover:text-ink"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.6" />
      </svg>
    </button>
  )
}
