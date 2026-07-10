import { create } from 'zustand'

interface ThemeState {
  dark: boolean
  toggle: () => void
}

const stored = typeof window !== 'undefined' && window.localStorage.getItem('theme') === 'dark'

if (stored) {
  document.documentElement.classList.add('dark')
}

export const useThemeStore = create<ThemeState>((set) => ({
  dark: stored,
  toggle: () =>
    set((s) => {
      const next = !s.dark
      document.documentElement.classList.toggle('dark', next)
      window.localStorage.setItem('theme', next ? 'dark' : 'light')
      return { dark: next }
    }),
}))
