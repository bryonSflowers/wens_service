import { useState } from 'react'
import { BarChart3, Activity, RefreshCw, AlertTriangle, GitCompare } from 'lucide-react'
import client from '../api/client'
import { CompanySelector } from '../components/ui/CompanySelector'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'

interface CompareItem {
  ticker: string
  pe_ratio: number | null
  pb_ratio: number | null
  ev_ebitda: number | null
  roe: number | null
  debt_to_equity: number | null
  eps: number | null
  eps_growth_pct: number | null
  dividend_yield: number | null
  market_cap: number | null
  sector: string | null
  industry: string | null
  performance?: {
    price_change_1y_pct?: number
    current_price?: number
    volatility_pct?: number
    sharpe?: number
    max_drawdown_pct?: number
  }
}

export function ComparePage() {
  const [selected, setSelected] = useState<string[]>([])
  const [items, setItems] = useState<CompareItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const compare = async () => {
    if (selected.length < 2) { setError('Select at least 2 companies'); return }
    setLoading(true); setError('')
    try {
      const res = await client.get('/compare/full', { params: { tickers: selected.join(',') } })
      setItems(res.data.items || [])
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Comparison failed')
    }
    setLoading(false)
  }

  const val = (v: number | null | undefined, suffix = '', decimals = 2) =>
    v != null ? `${v.toFixed(decimals)}${suffix}` : '-'

  const pct = (v: number | null | undefined) =>
    v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '-'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Company Comparison</h1>
          <p className="page-subtitle">Side-by-side fundamentals, risk, and performance across competitors</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <CompanySelector selected={selected} onChange={setSelected} />
          <div className="flex items-center gap-2 pt-2 border-t border-[var(--card-border)]">
            <button className="btn-primary" onClick={compare} disabled={loading || selected.length < 2}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
              Compare {selected.length} Companies
            </button>
            {error && <span className="text-sm text-red-500 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{error}</span>}
          </div>
        </div>
      </div>

      {loading && <PageLoading />}

      {!loading && items.length > 0 && (
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="card-header"><h3 className="font-semibold text-sm"><BarChart3 className="w-4 h-4 inline mr-2" />Valuation</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Metric</th>
                  {items.map((i) => <th key={i.ticker} className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">{i.ticker}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    ['Market Cap', (i: CompareItem) => val(i.market_cap != null ? i.market_cap / 1e9 : null, 'B')],
                    ['P/E Ratio', (i: CompareItem) => val(i.pe_ratio, 'x')],
                    ['P/B Ratio', (i: CompareItem) => val(i.pb_ratio, 'x')],
                    ['EV/EBITDA', (i: CompareItem) => val(i.ev_ebitda, 'x')],
                    ['Div Yield', (i: CompareItem) => val(i.dividend_yield != null ? i.dividend_yield * 100 : null, '%')],
                    ['ROE', (i: CompareItem) => val(i.roe != null ? i.roe * 100 : null, '%')],
                    ['EPS', (i: CompareItem) => val(i.eps)],
                    ['EPS Growth', (i: CompareItem) => val(i.eps_growth_pct != null ? i.eps_growth_pct * 100 : null, '%')],
                    ['D/E', (i: CompareItem) => val(i.debt_to_equity)],
                    ['Sector', (i: CompareItem) => i.sector || '-'],
                  ].map(([label, fn]) => (
                    <tr key={String(label)} className="border-b border-[var(--card-border)]">
                      <td className="px-4 py-3 font-medium text-[var(--text)]">{String(label)}</td>
                      {items.map((i) => (
                        <td key={i.ticker} className="px-4 py-3 text-right font-mono text-[var(--text)]">{(fn as Function)(i)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header"><h3 className="font-semibold text-sm"><Activity className="w-4 h-4 inline mr-2" />Performance & Risk (1Y)</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Metric</th>
                  {items.map((i) => <th key={i.ticker} className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">{i.ticker}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    ['Current Price', (i: CompareItem) => val(i.performance?.current_price)],
                    ['1Y Return', (i: CompareItem) => <span className={i.performance?.price_change_1y_pct != null && i.performance.price_change_1y_pct >= 0 ? 'text-green-600' : 'text-red-500'}>{pct(i.performance?.price_change_1y_pct)}</span>],
                    ['Volatility', (i: CompareItem) => val(i.performance?.volatility_pct, '%')],
                    ['Sharpe Ratio', (i: CompareItem) => val(i.performance?.sharpe)],
                    ['Max Drawdown', (i: CompareItem) => <span className="text-red-500">{val(i.performance?.max_drawdown_pct, '%')}</span>],
                  ].map(([label, fn]) => (
                    <tr key={String(label)} className="border-b border-[var(--card-border)]">
                      <td className="px-4 py-3 font-medium text-[var(--text)]">{String(label)}</td>
                      {items.map((i) => (
                        <td key={i.ticker} className="px-4 py-3 text-right font-mono text-[var(--text)]">{(fn as Function)(i)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <EmptyState title="Select companies" description="Choose 2–6 companies above to compare fundamentals and performance side-by-side." icon="chart" />
      )}
    </div>
  )
}
