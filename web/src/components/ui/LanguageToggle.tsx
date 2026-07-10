import { useLangStore } from '../../store/language'

const LANGS = [
  { value: 'en',    label: 'EN' },
  { value: 'zh-TW', label: '繁中' },
] as const

export function LanguageToggle() {
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)

  return (
    <div className="flex items-center rounded-md border border-[var(--card-border)] overflow-hidden">
      {LANGS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setLang(value)}
          className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
            lang === value
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
