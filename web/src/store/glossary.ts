import { create } from 'zustand'

interface GlossaryState {
  enabled: boolean
  toggle: () => void
}

const stored = typeof window !== 'undefined' ? localStorage.getItem('glossary') === 'true' : false

export const useGlossaryStore = create<GlossaryState>((set) => ({
  enabled: stored,
  toggle: () =>
    set((s) => {
      const next = !s.enabled
      localStorage.setItem('glossary', String(next))
      return { enabled: next }
    }),
}))
