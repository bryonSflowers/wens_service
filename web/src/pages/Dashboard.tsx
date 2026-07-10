import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import {
  DollarSign, TrendingUp, Activity, BarChart3,
  PieChart, Search, ExternalLink, RefreshCw,
} from 'lucide-react'
import { reportsApi, portfolioApi, fundamentalsApi } from '../api/client'
import { StatCard } from '../components/ui/StatCard'
import { AnimatedCounter } from '../components/ui/AnimatedCounter'
import { PageSkeleton } from '../components/ui/Skeleton'
import { useT } from '../i18n'
import { EmptyState } from '../components/ui/EmptyState'
import type { MonthlyReport, PortfolioSummary, Fundamental } from '../types'

export function DashboardPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(999)
  const [searchTicker, setSearchTicker] = useState('')
  const [searchResult, setSearchResult] = useState<Fundamental | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const _ = useT()

  const PERIODS = [
    { label: _('dashboard.period6m'), value: 6 },
    { label: _('dashboard.period1y'), value: 12 },
    { label: _('dashboard.periodAll'), value: 999 },
  ]

  useEffect(() => {
    Promise.all([
      reportsApi.list({ page_size: 50 }),
      portfolioApi.list().catch(() => ({ data: [] })),
    ]).then(([r, portfolios]) => {
      setReports(r.data.items)
      if (portfolios.data.length > 0) {
        portfolioApi.summary(portfolios.data[0].id).then((s) => setPortfolioSummary(s.data)).catch(() => {})
      }
    }).finally(() => setLoading(false))
  }, [])

  const handleSearch = async () => {
    if (!searchTicker.trim()) return
    setSearchLoading(true)
    try {
      const res = await fundamentalsApi.get(searchTicker.trim())
      setSearchResult(res.data)
    } catch { setSearchResult(null) }
    setSearchLoading(false)
  }

  if (loading) return <PageSkeleton />

  const filtered = period < 999 ? reports.slice(-period) : reports
  const chartData = [...filtered].reverse().map((r) => ({
    label: `${r.year}-${String(r.month).padStart(2, '0')}`,
    revenue: r.revenue ?? 0,
    expenses: r.expenses ?? 0,
    net_income: r.net_income ?? 0,
  }))

  const totalRevenue = reports.reduce((s, r) => s + (r.revenue ?? 0), 0)
  const totalNetIncome = reports.reduce((s, r) => s + (r.net_income ?? 0), 0)
  const avgMargin = totalRevenue > 0 ? ((totalNetIncome / totalRevenue) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{_('dashboard.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{_('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="live-dot bg-green-400" />
          <span className="text-xs text-[var(--text-secondary)]">{_('dashboard.live')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={_('dashboard.totalRevenue')}
          value={<AnimatedCounter value={totalRevenue / 1000} decimals={1} suffix="B" prefix="NT$" />}
          icon={DollarSign}
        />
        <StatCard
          label={_('dashboard.netIncome')}
          value={<AnimatedCounter value={totalNetIncome / 1000} decimals={1} suffix="B" prefix="NT$" />}
          icon={TrendingUp}
        />
        <StatCard
          label={_('dashboard.avgMargin')}
          value={<AnimatedCounter value={avgMargin} decimals={1} suffix="%" />}
          icon={Activity}
          trend={{ value: 'TTM', positive: avgMargin > 10 }}
        />
        <StatCard
          label={_('dashboard.reports')}
          value={reports.length}
          icon={BarChart3}
        />
      </div>

      {portfolioSummary && (
        <div className="glass rounded-xl">
          <div className="card-header">
            <h3 className="font-semibold text-sm flex items-center gap-2"><PieChart className="w-4 h-4" /> {_('dashboard.portfolioSnapshot')}</h3>
            <button className="btn-secondary text-xs" onClick={() => navigate('/portfolio')}>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{portfolioSummary.name}</p>
                <p className="text-lg font-bold font-mono">{portfolioSummary.holding_count} {_('dashboard.holdings')}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{_('dashboard.totalValue')}</p>
                <p className="text-lg font-bold font-mono">
                  <AnimatedCounter value={portfolioSummary.total_value} prefix="$" />
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{_('dashboard.totalCost')}</p>
                <p className="text-lg font-bold font-mono">
                  <AnimatedCounter value={portfolioSummary.total_cost} prefix="$" />
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{_('dashboard.unrealizedPnl')}</p>
                <p className={`text-lg font-bold font-mono ${portfolioSummary.total_unrealized_pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {portfolioSummary.total_unrealized_pnl >= 0 ? '▲' : '▼'} {Math.abs(portfolioSummary.total_unrealized_pnl_pct)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass rounded-xl">
        <div className="card-header">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Search className="w-4 h-4" /> {_('dashboard.quickLookup')}</h3>
        </div>
        <div className="card-body">
          <div className="flex gap-2 flex-wrap">
            <input
              className="input max-w-xs"
              placeholder={_('dashboard.tickerPlaceholder')}
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn-primary" onClick={handleSearch} disabled={searchLoading}>
              {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          {searchResult && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><span className="text-xs text-[var(--text-secondary)]">P/E</span><p className="font-semibold font-mono">{searchResult.pe_ratio?.toFixed(2) ?? '-'}</p></div>
              <div><span className="text-xs text-[var(--text-secondary)]">P/B</span><p className="font-semibold font-mono">{searchResult.pb_ratio?.toFixed(2) ?? '-'}</p></div>
              <div><span className="text-xs text-[var(--text-secondary)]">Div Yield</span><p className="font-semibold font-mono">{searchResult.dividend_yield != null ? `${(searchResult.dividend_yield * 100).toFixed(2)}%` : '-'}</p></div>
              <div><span className="text-xs text-[var(--text-secondary)]">Market Cap</span><p className="font-semibold font-mono">{searchResult.market_cap ? `$${(searchResult.market_cap / 1e9).toFixed(2)}B` : '-'}</p></div>
            </div>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text)]">{_('dashboard.financialCharts')}</h3>
            <div className="pill-group">
              {PERIODS.map((p) => (
                <button
                  key={p.label}
                  className={`pill ${period === p.value ? 'active' : ''}`}
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-4">{_('dashboard.revenueExpenses')}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass rounded-xl p-6">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-4">{_('dashboard.netIncomeTrend')}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="net_income" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="Net Income" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {!chartData.length && <EmptyState title={_('dashboard.noData')} description={_('dashboard.noDataDesc')} icon="chart" />}
    </div>
  )
}
