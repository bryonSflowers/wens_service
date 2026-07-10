import { getTickerName } from '../../utils/tickers'
import { COMPANY_COLORS } from './CompanySelector'

interface CompanyLegendProps {
  tickers: string[]
  size?: 'sm' | 'md'
}

export function CompanyLegend({ tickers, size = 'sm' }: CompanyLegendProps) {
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'
  return (
    <div className={`flex items-center gap-3 ${textSize} text-[var(--text-secondary)]`}>
      {tickers.map((t) => (
        <div key={t} className="flex items-center gap-1.5">
          <span className={`${dotSize} rounded-full shrink-0`} style={{ backgroundColor: COMPANY_COLORS[t] || '#6b7280' }} />
          <span className="font-medium">{getTickerName(t)}</span>
          <span className="font-mono opacity-60">{t.replace('.TW', '')}</span>
        </div>
      ))}
    </div>
  )
}
