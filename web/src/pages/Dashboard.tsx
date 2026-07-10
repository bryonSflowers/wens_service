import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  DollarSign, TrendingUp, Activity, BarChart3,
  PieChart, Search, ExternalLink, RefreshCw,
} from 'lucide-react'
import { reportsApi, portfolioApi, fundamentalsApi } from '../api/client'
import { StatCard } from '../components/ui/StatCard'
import { AnimatedCounter } from '../components/ui/AnimatedCounter'
import { ChartTooltip } from '../components/ui/ChartTooltip'
import { PageSkeleton } from '../components/ui/Skeleton'
import { useT } from '../i18n'
import { EmptyState } from '../components/ui/EmptyState'
import type { MonthlyReport, PortfolioSummary, Fundamental } from '../types'

const fmt = (v: number | string, _name: string) =>
  `NT$${Number(v).toLocaleString()}M`

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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{_('dashboard.title')}</h1>
          <p className="page-subtitle">{_('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)]">
          <span className="live-dot bg-green-400" />
          <span className="text-xs font-medium text-[var(--text-secondary)]">{_('dashboard.live')}</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          color="blue"
          label={_('dashboard.totalRevenue')}
          value={<AnimatedCounter value={totalRevenue / 1000} decimals={1} suffix="B" prefix="NT$" />}
          icon={DollarSign}
        />
        <StatCard
          color="green"
          label={_('dashboard.netIncome')}
          value={<AnimatedCounter value={totalNetIncome / 1000} decimals={1} suffix="B" prefix="NT$" />}
          icon={TrendingUp}
        />
        <StatCard
          color="purple"
          label={_('dashboard.avgMargin')}
          value={<AnimatedCounter value={avgMargin} decimals={1} suffix="%" />}
          icon={Activity}
          trend={{ value: 'TTM', positive: avgMargin > 10 }}
        />
        <StatCard
          color="amber"
          label={_('dashboard.reports')}
          value={reports.length}
          icon={BarChart3}
        />
      </div>

      {/* Portfolio snapshot */}
      {portfolioSummary && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-[var(--text)]">
              <PieChart className="w-4 h-4 text-[var(--accent)]" />
              {_('dashboard.portfolioSnapshot')}
            </h3>
            <button className="btn btn-secondary text-xs py-1 px-2" onClick={() => navigate('/portfolio')}>
              <ExternalLink className="w-3 h-3" /> View
            </button>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Portfolio', value: `${portfolioSummary.holding_count} ${_('dashboard.holdings')}` },
                { label: _('dashboard.totalValue'), value: <AnimatedCounter value={portfolioSummary.total_value} prefix="$" /> },
                { label: _('dashboard.totalCost'),  value: <AnimatedCounter value={portfolioSummary.total_cost} prefix="$" /> },
                {
                  label: _('dashboard.unrealizedPnl'),
                  value: (
                    <span className={portfolioSummary.total_unrealized_pnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                      {portfolioSummary.total_unrealized_pnl >= 0 ? '▲' : '▼'} {Math.abs(portfolioSummary.total_unrealized_pnl_pct)}%
                    </span>
                  ),
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
                  <p className="text-lg font-bold font-mono text-[var(--text)]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick lookup */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-[var(--text)]">
            <Search className="w-4 h-4 text-[var(--accent)]" />
            {_('dashboard.quickLookup')}
          </h3>
        </div>
        <div className="card-body">
          <div className="flex gap-2">
            <input
              className="input max-w-xs"
              placeholder={_('dashboard.tickerPlaceholder')}
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn btn-primary" onClick={handleSearch} disabled={searchLoading}>
              {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          {searchResult && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--card-border)]">
              {[
                { label: 'P/E',        value: searchResult.pe_ratio?.toFixed(2) ?? '-' },
                { label: 'P/B',        value: searchResult.pb_ratio?.toFixed(2) ?? '-' },
                { label: 'Div Yield',  value: searchResult.dividend_yield != null ? `${(searchResult.dividend_yield * 100).toFixed(2)}%` : '-' },
                { label: 'Market Cap', value: searchResult.market_cap ? `$${(searchResult.market_cap / 1e9).toFixed(2)}B` : '-' },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-lg bg-[var(--accent-light)]">
                  <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
                  <p className="font-semibold font-mono text-[var(--text)]">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text)]">{_('dashboard.financialCharts')}</h3>
            <div className="pill-group">
              {PERIODS.map((p) => (
                <button key={p.label} className={`pill ${period === p.value ? 'active' : ''}`} onClick={() => setPeriod(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses — grouped bar */}
            <div className="card p-6">
              <p className="text-sm font-semibold text-[var(--text)] mb-4">{_('dashboard.revenueExpenses')}</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <defs>
                    <linearGradient id="barRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="barExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<ChartTooltip formatter={fmt} />} cursor={{ fill: 'rgba(59,130,246,0.04)' }} />
                  <Bar dataKey="revenue"  fill="url(#barRevenue)"  radius={[4,4,0,0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="url(#barExpenses)" radius={[4,4,0,0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Net income — area chart with gradient */}
            <div className="card p-6">
              <p className="text-sm font-semibold text-[var(--text)] mb-4">{_('dashboard.netIncomeTrend')}</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="areaNetIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<ChartTooltip formatter={fmt} />} cursor={{ stroke: 'var(--text-tertiary)', strokeWidth: 1, strokeDasharray: '4 2' }} />
                  <Area
                    type="monotone"
                    dataKey="net_income"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#areaNetIncome)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: '#22c55e' }}
                    name="Net Income"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <EmptyState title={_('dashboard.noData')} description={_('dashboard.noDataDesc')} icon="chart" />
      )}
    </div>
  )
}
