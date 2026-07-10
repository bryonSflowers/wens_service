import { useState, useRef, useEffect } from 'react'
import { Building2, Search, ChevronDown } from 'lucide-react'
import { TICKER_DATA, TICKER_SECTORS, type TickerInfo } from '../../utils/tickers'

interface TickerDropdownProps {
  value: string
  onChange: (value: string) => void
}

export function TickerDropdown({ value, onChange }: TickerDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered: { sector: string; items: TickerInfo[] }[] = []
  const lower = query.toLowerCase()

  for (const [skey, slabel] of Object.entries(TICKER_SECTORS)) {
    const items = TICKER_DATA.filter(
      (t) =>
        t.sector === skey &&
        (t.ticker.toLowerCase().includes(lower) ||
          t.name.includes(lower))
    )
    if (items.length > 0) filtered.push({ sector: slabel, items })
  }

  const selected = TICKER_DATA.find((t) => t.ticker === value)

  return (
    <div ref={ref} className="relative">
      <label className="label flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Company / Ticker</label>
      <div
        className="input flex items-center gap-2 cursor-pointer pr-2"
        onClick={() => { setOpen(!open); setQuery('') }}
      >
        <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
        <span className="flex-1 text-sm">
          {selected ? `${selected.name} (${selected.ticker})` : value || 'Select a company...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-xl">
          <div className="sticky top-0 bg-[var(--card-bg)] border-b border-[var(--card-border)] p-2">
            <input
              className="w-full text-sm bg-transparent outline-none placeholder-[var(--text-secondary)]"
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {filtered.length === 0 && (
            <div className="p-4 text-sm text-[var(--text-secondary)] text-center">No matches</div>
          )}
          {filtered.map((group) => (
            <div key={group.sector}>
              <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {group.sector}
              </div>
              {group.items.map((item) => (
                <button
                  key={item.ticker}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--sidebar-link-hover)] transition-colors ${
                    value === item.ticker ? 'bg-[var(--sidebar-link-active)]' : ''
                  }`}
                  onClick={(e) => { e.stopPropagation(); onChange(item.ticker); setOpen(false) }}
                >
                  <span className="text-sm font-medium text-[var(--text)]">{item.name}</span>
                  <span className="text-xs text-[var(--text-secondary)] ml-auto">{item.ticker}</span>
                </button>
              ))}
            </div>
          ))}
          {query && (
            <button
              className="w-full text-left px-3 py-2.5 text-sm text-blue-500 hover:bg-[var(--sidebar-link-hover)] border-t border-[var(--card-border)]"
              onClick={(e) => { e.stopPropagation(); onChange(query.toUpperCase()); setOpen(false) }}
            >
              Use "{query.toUpperCase()}" as custom ticker
            </button>
          )}
        </div>
      )}
    </div>
  )
}
