import { create } from 'zustand'
import { KEYS, readString, writeString } from '../services/storage'

export type ThemeChoice = 'system' | 'light' | 'dark'

const isChoice = (value: string | null): value is ThemeChoice =>
  value === 'system' || value === 'light' || value === 'dark'

function apply(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}

interface ThemeState {
  choice: ThemeChoice
  init: () => void
  set: (choice: ThemeChoice) => void
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  choice: 'system',

  init() {
    const stored = readString(KEYS.theme)
    const choice: ThemeChoice = isChoice(stored) ? stored : 'system'
    apply(choice)
    set({ choice })
  },

  set(choice) {
    apply(choice)
    writeString(KEYS.theme, choice)
    set({ choice })
  },

  toggle() {
    const current = get().choice
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    const effectiveDark = current === 'dark' || (current === 'system' && prefersDark)
    get().set(effectiveDark ? 'light' : 'dark')
  },
}))
