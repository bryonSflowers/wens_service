import { useState } from 'react'
import {
  Search, RefreshCw, Building2,
  PieChart, BarChart3, Activity, AlertTriangle,
} from 'lucide-react'
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
      const res = refresh
        ? await fundamentalsApi.refresh(ticker.trim())
        : await fundamentalsApi.get(ticker.trim())
      setData(res.data)
    } catch {
      setError(`Could not fetch fundamentals for ${ticker}.`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const MetricRow = ({ label, value, suffix }: { label: string; value: number | null | undefined; suffix?: string }) => (
    <div className="flex justify-between py-3 border-b border-gray-100">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold">
        {value != null ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix ?? ''}` : '-'}
      </span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fundamental Data</h1>
        <p className="text-sm text-gray-500 mt-1">Financial ratios, earnings, and valuation metrics</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex gap-2">
            <input
              className="input max-w-xs"
              placeholder="Ticker (e.g., 3045.TW)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            />
            <button className="btn-primary" onClick={() => fetchData()} disabled={loading || !ticker.trim()}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
            {data && (
              <button className="btn-secondary" onClick={() => fetchData(true)} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <PageLoading />}
      {error && <div className="card p-6 text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />{error}</div>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Building2 className="w-4 h-4" /> Company Profile</h3>
            <MetricRow label="Sector" value={null} />
            <div className="flex justify-between py-3 border-b border-gray-100">
              <span className="text-sm text-gray-500">Sector</span>
              <span className="text-sm font-semibold">{data.sector ?? '-'}</span>
            </div>
            <MetricRow label="Industry" value={null} />
            <div className="flex justify-between py-3 border-b border-gray-100">
              <span className="text-sm text-gray-500">Industry</span>
              <span className="text-sm font-semibold">{data.industry ?? '-'}</span>
            </div>
            <MetricRow label="Market Cap" value={data.market_cap != null ? data.market_cap / 1e9 : null} suffix="B" />
            <div className="pt-2 text-xs text-gray-400">Last updated: {data.updated_at ? new Date(data.updated_at).toLocaleDateString() : '-'}</div>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Valuation</h3>
            <MetricRow label="P/E Ratio" value={data.pe_ratio} suffix="x" />
            <MetricRow label="P/B Ratio" value={data.pb_ratio} suffix="x" />
            <MetricRow label="EV/EBITDA" value={data.ev_ebitda} suffix="x" />
            <MetricRow label="Dividend Yield" value={data.dividend_yield != null ? data.dividend_yield * 100 : null} suffix="%" />
            <MetricRow label="Payout Ratio" value={data.dividend_payout_ratio != null ? data.dividend_payout_ratio * 100 : null} suffix="%" />
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Profitability</h3>
            <MetricRow label="ROE" value={data.roe != null ? data.roe * 100 : null} suffix="%" />
            <MetricRow label="EPS" value={data.eps} />
            <MetricRow label="EPS Growth" value={data.eps_growth_pct != null ? data.eps_growth_pct * 100 : null} suffix="%" />
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><PieChart className="w-4 h-4" /> Financial Health</h3>
            <MetricRow label="Debt-to-Equity" value={data.debt_to_equity} />
            {data.pe_ratio && (
              <div className="mt-4 p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500 mb-1">PEG Ratio (approx)</p>
                <p className="text-lg font-bold">
                  {data.eps_growth_pct && data.eps_growth_pct > 0
                    ? (data.pe_ratio / (data.eps_growth_pct * 100)).toFixed(2)
                    : 'N/A (no EPS growth)'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
