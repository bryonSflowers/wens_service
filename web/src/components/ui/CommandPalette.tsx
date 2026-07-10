import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'lucide-react'

const PAGES = [
  { path: '/', label: 'Market Overview', keywords: 'dashboard home market' },
  { path: '/portfolio', label: 'Portfolio', keywords: 'portfolio holdings positions pnl' },
  { path: '/watchlist', label: 'Watchlists', keywords: 'watchlist alerts price alerts' },
  { path: '/risk', label: 'Risk Analytics', keywords: 'risk volatility sharpe beta var' },
  { path: '/fundamentals', label: 'Fundamentals', keywords: 'fundamentals pe ratio valuation' },
  { path: '/chart', label: 'Stock Chart', keywords: 'chart candlestick ohlcv technical' },
  { path: '/screener', label: 'Screener', keywords: 'screener filter stocks scan' },
  { path: '/reports', label: 'Reports', keywords: 'reports monthly financial' },
  { path: '/reports/generate', label: 'Generate Report', keywords: 'generate ai report llm' },
  { path: '/templates', label: 'Templates', keywords: 'templates saved queries' },
  { path: '/generated', label: 'Generated Reports', keywords: 'generated history previous' },
  { path: '/chat', label: 'LLM Chat', keywords: 'chat ai analyst ask' },
  { path: '/kv', label: 'KV Store', keywords: 'kv store key value' },
  { path: '/documents', label: 'Documents', keywords: 'documents upload files excel word' },
  { path: '/admin', label: 'Admin', keywords: 'admin settings config' },
  { path: '/settings', label: 'Settings', keywords: 'settings profile api keys' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelected(0)
    }
  }, [open])

  const filtered = PAGES.filter(
    (p) =>
      p.label.toLowerCase().includes(query.toLowerCase()) ||
      p.keywords.toLowerCase().includes(query.toLowerCase()),
  )

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); filtered[selected] && go(filtered[selected].path) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-700">
          <Command className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 px-3 py-3 bg-transparent text-sm outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKey}
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No results</p>}
          {filtered.map((p, i) => (
            <button
              key={p.path}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                i === selected
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
              onClick={() => go(p.path)}
              onMouseEnter={() => setSelected(i)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
