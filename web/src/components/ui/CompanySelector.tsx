import { X, Plus } from 'lucide-react'
import { TICKER_DATA, getTickerName, TICKER_SECTORS, type TickerInfo } from '../../utils/tickers'

export const COMPANY_COLORS: Record<string, string> = {
  '3045.TW': '#2563eb',
  '4904.TW': '#7c3aed',
  '2412.TW': '#059669',
  '2330.TW': '#dc2626',
  '2454.TW': '#d97706',
  '3008.TW': '#0891b2',
  '2308.TW': '#4f46e5',
  '2317.TW': '#0891b2',
  '2881.TW': '#c026d3',
  '2882.TW': '#9333ea',
  '1301.TW': '#2563eb',
  '1303.TW': '#7c3aed',
  '1326.TW': '#059669',
  '2002.TW': '#78716c',
  '1216.TW': '#dc2626',
  '0050.TW': '#16a34a',
}

function getInitials(name: string): string {
  return name.replace(/[^一-龥A-Za-z]/g, '').slice(0, 1) || name.slice(0, 1)
}

export function CompanyAvatar({ ticker, size = 'md' }: { ticker: string; size?: 'sm' | 'md' | 'lg' }) {
  const name = getTickerName(ticker)
  const color = COMPANY_COLORS[ticker] || '#6b7280'
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-16 h-16 text-lg' }

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}
      title={`${name} (${ticker})`}
    >
      {getInitials(name)}
    </div>
  )
}

interface CompanySelectorProps {
  selected: string[]
  onChange: (tickers: string[]) => void
  max?: number
}

export function CompanySelector({ selected, onChange, max = 6 }: CompanySelectorProps) {
  const grouped = TICKER_DATA.reduce<Record<string, TickerInfo[]>>((acc, t) => {
    if (!acc[t.sector]) acc[t.sector] = []
    acc[t.sector].push(t)
    return acc
  }, {})

  const toggle = (ticker: string) => {
    if (selected.includes(ticker)) {
      onChange(selected.filter((t) => t !== ticker))
    } else if (selected.length < max) {
      onChange([...selected, ticker])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {selected.map((ticker) => (
          <button
            key={ticker}
            onClick={() => toggle(ticker)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 group hover:border-blue-400 transition-colors"
          >
            <CompanyAvatar ticker={ticker} size="sm" />
            <span className="text-sm font-medium">{getTickerName(ticker)}</span>
            <X className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600" />
          </button>
        ))}
        {selected.length < max && (
          <span className="text-xs text-[var(--text-secondary)]">
            {selected.length === 0 ? 'Select 2–6 companies below' : `${selected.length}/${max} selected`}
          </span>
        )}
      </div>

      {Object.entries(TICKER_SECTORS).map(([skey, slabel]) => {
        const items = grouped[skey] || []
        return (
          <div key={skey}>
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">{slabel}</h4>
            <div className="flex gap-2 flex-wrap">
              {items.map((item) => {
                const isSelected = selected.includes(item.ticker)
                const isMaxed = selected.length >= max && !isSelected
                return (
                  <button
                    key={item.ticker}
                    onClick={() => toggle(item.ticker)}
                    disabled={isMaxed}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      isSelected
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : isMaxed
                        ? 'border-[var(--card-border)] opacity-40 cursor-not-allowed'
                        : 'border-[var(--card-border)] hover:border-blue-300 hover:bg-[var(--sidebar-link-hover)]'
                    }`}
                  >
                    {isSelected ? (
                      <X className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 opacity-50" />
                    )}
                    <CompanyAvatar ticker={item.ticker} size="sm" />
                    <span>{item.name}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{item.ticker.replace('.TW', '')}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
