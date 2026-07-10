import { useState } from 'react'
import { Search, RefreshCw, Building2, PieChart, BarChart3, Activity, AlertTriangle } from 'lucide-react'
import { fundamentalsApi } from '../api/client'
import { PageLoading } from '../components/ui/Loading'
import type { Fundamental } from '../types'

export function FundamentalsPage() {
  const [ticker, setTicker] = useState('3045.TW')
  const [data, setData] = useState<Fundamental | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const fetchData = async (refresh = false) => {
    if (!ticker.trim()) return
    if (refresh) setRefreshing(true); else setLoading(true)
    setError('')
    try {
      const res = refresh ? await fundamentalsApi.refresh(ticker.trim()) : await fundamentalsApi.get(ticker.trim())
      setData(res.data)
    } catch { setError(`Could not fetch fundamentals for ${ticker}.`) }
    finally { setLoading(false); setRefreshing(false) }
  }

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-3 border-b border-[var(--card-border)]">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm font-semibold font-mono">{value}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Fundamental Data</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Financial ratios, earnings, and valuation</p>
      </div>

      <div className="card">
        <div className="card-body flex gap-2 flex-wrap">
          <input className="input max-w-xs" placeholder="Ticker (e.g., 3045.TW)" value={ticker}
            onChange={(e) => setTicker(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()} />
          <button className="btn-primary" onClick={() => fetchData()} disabled={loading || !ticker.trim()}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
          </button>
          {data && <button className="btn-secondary" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>}
        </div>
      </div>

      {loading && <PageLoading />}
      {error && <div className="card p-4 text-red-500 dark:text-red-400 flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2"><Building2 className="w-4 h-4" /> Company Profile</h3>
            <Row label="Sector" value={data.sector ?? '-'} />
            <Row label="Industry" value={data.industry ?? '-'} />
            <Row label="Market Cap" value={data.market_cap != null ? `$${(data.market_cap / 1e9).toFixed(2)}B` : '-'} />
            <div className="pt-2 text-xs text-[var(--text-secondary)]">Updated: {data.updated_at ? new Date(data.updated_at).toLocaleDateString() : '-'}</div>
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Valuation</h3>
            <Row label="P/E Ratio" value={data.pe_ratio != null ? `${data.pe_ratio.toFixed(2)}x` : '-'} />
            <Row label="P/B Ratio" value={data.pb_ratio != null ? `${data.pb_ratio.toFixed(2)}x` : '-'} />
            <Row label="EV/EBITDA" value={data.ev_ebitda != null ? `${data.ev_ebitda.toFixed(2)}x` : '-'} />
            <Row label="Div Yield" value={data.dividend_yield != null ? `${(data.dividend_yield * 100).toFixed(2)}%` : '-'} />
            <Row label="Payout Ratio" value={data.dividend_payout_ratio != null ? `${(data.dividend_payout_ratio * 100).toFixed(1)}%` : '-'} />
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Profitability</h3>
            <Row label="ROE" value={data.roe != null ? `${(data.roe * 100).toFixed(1)}%` : '-'} />
            <Row label="EPS" value={data.eps != null ? `$${data.eps.toFixed(2)}` : '-'} />
            <Row label="EPS Growth" value={data.eps_growth_pct != null ? `${(data.eps_growth_pct * 100).toFixed(1)}%` : '-'} />
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2"><PieChart className="w-4 h-4" /> Financial Health</h3>
            <Row label="Debt-to-Equity" value={data.debt_to_equity != null ? data.debt_to_equity.toFixed(2) : '-'} />
            {data.pe_ratio && data.eps_growth_pct && data.eps_growth_pct > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-[var(--sidebar-link-hover)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">PEG Ratio</p>
                <p className="text-lg font-bold font-mono">{(data.pe_ratio / (data.eps_growth_pct * 100)).toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
