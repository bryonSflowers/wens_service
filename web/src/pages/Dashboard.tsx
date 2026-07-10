import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import {
  TrendingUp, DollarSign, Activity, BarChart3,
  PieChart, Search, ExternalLink, RefreshCw,
} from 'lucide-react'
import { reportsApi, portfolioApi, fundamentalsApi } from '../api/client'
import { StatCard } from '../components/ui/StatCard'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'
import type { MonthlyReport, PortfolioSummary, Fundamental } from '../types'

export function DashboardPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTicker, setSearchTicker] = useState('')
  const [searchResult, setSearchResult] = useState<Fundamental | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      reportsApi.list({ page_size: 50 }),
      portfolioApi.list().catch(() => ({ data: [] })),
    ]).then(([r, portfolios]) => {
      setReports(r.data.items)
      if (portfolios.data.length > 0) {
        portfolioApi.summary(portfolios.data[0].id).then((s) => {
          setPortfolioSummary(s.data)
        }).catch(() => {})
      }
    }).finally(() => setLoading(false))
  }, [])

  const handleSearch = async () => {
    if (!searchTicker.trim()) return
    setSearchLoading(true)
    try {
      const res = await fundamentalsApi.get(searchTicker.trim())
      setSearchResult(res.data)
    } catch {
      setSearchResult(null)
    } finally {
      setSearchLoading(false)
    }
  }

  if (loading) return <PageLoading />

  const chartData = [...reports].reverse().map((r) => ({
    label: `${r.year}-${String(r.month).padStart(2, '0')}`,
    revenue: r.revenue ?? 0,
    expenses: r.expenses ?? 0,
    net_income: r.net_income ?? 0,
  }))

  const totalRevenue = reports.reduce((s, r) => s + (r.revenue ?? 0), 0)
  const totalNetIncome = reports.reduce((s, r) => s + (r.net_income ?? 0), 0)
  const avgMargin = totalRevenue > 0 ? ((totalNetIncome / totalRevenue) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Market Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Taiwan Mobile (3045.TW) & Market Dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`NT$${(totalRevenue / 1000).toFixed(1)}B`} icon={DollarSign} />
        <StatCard label="Net Income" value={`NT$${(totalNetIncome / 1000).toFixed(1)}B`} icon={TrendingUp} />
        <StatCard label="Avg. Profit Margin" value={`${avgMargin}%`} icon={Activity} />
        <StatCard label="Reports" value={reports.length} icon={BarChart3} />
      </div>

      {portfolioSummary && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold flex items-center gap-2"><PieChart className="w-4 h-4" /> Portfolio Snapshot</h3>
            <button className="btn-secondary text-sm" onClick={() => navigate('/portfolio')}>
              View Details <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">{portfolioSummary.name}</p>
                <p className="text-lg font-bold">{portfolioSummary.holding_count} Holdings</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Value</p>
                <p className="text-lg font-bold">${portfolioSummary.total_value.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Cost</p>
                <p className="text-lg font-bold">${portfolioSummary.total_cost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Unrealized P&L</p>
                <p className={`text-lg font-bold ${portfolioSummary.total_unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {portfolioSummary.total_unrealized_pnl >= 0 ? '+' : ''}
                  ${portfolioSummary.total_unrealized_pnl.toLocaleString()}
                  <span className="text-sm ml-1">({portfolioSummary.total_unrealized_pnl_pct}%)</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2"><Search className="w-4 h-4" /> Quick Stock Lookup</h3>
        </div>
        <div className="card-body">
          <div className="flex gap-2">
            <input
              className="input max-w-xs"
              placeholder="Enter ticker (e.g., 3045.TW)"
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn-primary" onClick={handleSearch} disabled={searchLoading}>
              {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
          {searchResult && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><span className="text-xs text-gray-500">P/E</span><p className="font-semibold">{searchResult.pe_ratio?.toFixed(2) ?? '-'}</p></div>
              <div><span className="text-xs text-gray-500">P/B</span><p className="font-semibold">{searchResult.pb_ratio?.toFixed(2) ?? '-'}</p></div>
              <div><span className="text-xs text-gray-500">Div Yield</span><p className="font-semibold">{searchResult.dividend_yield != null ? `${(searchResult.dividend_yield * 100).toFixed(2)}%` : '-'}</p></div>
              <div><span className="text-xs text-gray-500">Market Cap</span><p className="font-semibold">{searchResult.market_cap ? `$${(searchResult.market_cap / 1e9).toFixed(2)}B` : '-'}</p></div>
              <div><span className="text-xs text-gray-500">ROE</span><p className="font-semibold">{searchResult.roe != null ? `${(searchResult.roe * 100).toFixed(1)}%` : '-'}</p></div>
              <div><span className="text-xs text-gray-500">EPS</span><p className="font-semibold">{searchResult.eps?.toFixed(2) ?? '-'}</p></div>
              <div><span className="text-xs text-gray-500">Sector</span><p className="font-semibold text-sm">{searchResult.sector ?? '-'}</p></div>
              <div><span className="text-xs text-gray-500">Industry</span><p className="font-semibold text-sm">{searchResult.industry ?? '-'}</p></div>
            </div>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue & Expenses (NT$M)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Net Income Trend (NT$M)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="net_income" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Net Income" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!chartData.length && <EmptyState title="No financial data" description="Run seed.py or sync market data to populate reports." />}
    </div>
  )
}
