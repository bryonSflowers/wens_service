import { create } from 'zustand'

export type Lang = 'en' | 'zh-TW'

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

const stored = (typeof window !== 'undefined' ? (localStorage.getItem('lang') as Lang) : null) || 'en'

export const useLangStore = create<LangState>((set) => ({
  lang: stored,
  setLang: (lang) => {
    localStorage.setItem('lang', lang)
    set({ lang })
  },
}))
