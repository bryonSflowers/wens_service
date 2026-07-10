import { useLangStore } from '../../store/language'
import { Languages } from 'lucide-react'

export function LanguageToggle() {
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)

  return (
    <div className="flex items-center gap-1">
      <Languages className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as 'en' | 'zh-TW')}
        className="text-xs bg-transparent text-[var(--text-secondary)] border-none outline-none cursor-pointer appearance-none"
      >
        <option value="en">EN</option>
        <option value="zh-TW">繁中</option>
      </select>
    </div>
  )
}
