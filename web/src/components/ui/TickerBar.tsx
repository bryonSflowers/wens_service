interface TickerItem {
  ticker: string
  price: number | null
  change?: number
}

interface TickerBarProps {
  items: TickerItem[]
}

export function TickerBar({ items }: TickerBarProps) {
  if (items.length === 0) return null

  const doubled = [...items, ...items]

  return (
    <div className="w-full overflow-hidden bg-slate-900 dark:bg-black border-b border-slate-700 h-10">
      <div className="ticker-track flex items-center h-full px-4">
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0 text-xs">
            <span className="font-semibold text-slate-200">{item.ticker}</span>
            <span className="font-mono text-slate-300">
              {item.price != null ? `$${item.price.toFixed(2)}` : '--'}
            </span>
            {item.change != null && (
              <span className={`font-mono ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change).toFixed(2)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
