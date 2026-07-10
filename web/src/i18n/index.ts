import { useLangStore } from '../store/language'
import en, { type TranslationKeys } from './en'
import zhTW from './zh-TW'

const translations: Record<string, Record<string, string>> = {
  en,
  'zh-TW': zhTW,
}

export function t(key: TranslationKeys): string {
  const lang = useLangStore.getState().lang
  const dict = translations[lang] || en
  return dict[key] ?? key
}

export function useT() {
  const lang = useLangStore((s) => s.lang)
  return (key: TranslationKeys): string => {
    const dict = translations[lang] || en
    return dict[key] ?? key
  }
}

export function tRaw(lang: string, key: string): string {
  const dict = translations[lang] || en
  return dict[key] ?? key
}
