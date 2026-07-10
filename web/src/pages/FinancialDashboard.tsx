import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import client from '../api/client'
import { PageLoading } from '../components/ui/Loading'

const TICKERS = ['3045.TW', '2412.TW', '4904.TW']
const COMPANY_NAMES: Record<string, string> = { '3045.TW': '台灣大', '2412.TW': '中華', '4904.TW': '遠傳' }
const COLORS: Record<string, string> = { '3045.TW': '#2563eb', '2412.TW': '#f59e0b', '4904.TW': '#22c55e' }

interface FinItem {
  ticker: string
  income_stmt: Record<string, Record<string, number | null>>
  balance_sheet: Record<string, Record<string, number | null>>
  cash_flow: Record<string, Record<string, number | null>>
}

const KPI_METRICS = [
  { key: 'Total Revenue', label: '營業收入', unit: '百萬', scale: 1e6 },
  { key: 'EBITDA', label: 'EBITDA', unit: '百萬', scale: 1e6 },
  { key: 'Operating Income', label: '營業利益', unit: '百萬', scale: 1e6 },
  { key: 'Net Income', label: '稅後淨利', unit: '百萬', scale: 1e6 },
  { key: 'Free Cash Flow', label: '自由現金流', unit: '百萬', scale: 1e6 },
  { key: 'Capital Expenditure', label: '資本支出', unit: '百萬', scale: 1e6 },
  { key: 'Total Assets', label: '總資產', unit: '百萬', scale: 1e6 },
  { key: 'Total Debt', label: '總負債', unit: '百萬', scale: 1e6 },
  { key: 'Cash And Cash Equivalents', label: '現金', unit: '百萬', scale: 1e6 },
  { key: 'Total Equity', label: '股東權益', unit: '百萬', scale: 1e6 },
]

function formatVal(v: number | null | undefined, scale = 1, decimals = 0): string {
  if (v == null) return '-'
  return (v / scale).toLocaleString(undefined, { maximumFractionDigits: decimals })
}

function yoy(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function cagr(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length < 2) return null
  const first = valid[0]
  const last = valid[valid.length - 1]
  if (first === 0) return null
  return ((last / first) ** (1 / (valid.length - 1)) - 1) * 100
}

export function FinancialDashboardPage() {
  const [data, setData] = useState<FinItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState('Total Revenue')
  const [timeRange, setTimeRange] = useState<'5y' | '10y' | 'all'>('5y')
  const [period, setPeriod] = useState<'year' | 'quarter'>('year')
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await client.get('/compare/financials', { params: { tickers: TICKERS.join(',') } })
      setData(res.data.items || [])
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return <PageLoading />
  if (error) return <div className="card p-6 text-red-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>

  // Build chart data for selected metric
  const allDates = new Set<string>()
  const metricData: Record<string, { date: string; value: number | null }[]> = { '3045.TW': [], '2412.TW': [], '4904.TW': [] }
  for (const item of data) {
    const stmts = [item.income_stmt, item.balance_sheet, item.cash_flow]
    for (const stmt of stmts) {
      for (const [dateStr, fields] of Object.entries(stmt)) {
        const val = fields[selectedMetric]
        if (val != null) {
          allDates.add(dateStr)
          metricData[item.ticker].push({ date: dateStr, value: val })
        }
      }
    }
  }

  const chartData = Array.from(allDates).sort().map((date) => {
    const point: any = { date: date.slice(0, 7) }
    for (const t of TICKERS) {
      const found = metricData[t].find((d) => d.date === date)
      point[t] = found?.value ?? null
    }
    return point
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">財務比較儀表板</h1>
          <p className="page-subtitle">台灣大 vs 中華 vs 遠傳 — 關鍵財務指標比較</p>
        </div>
        <div className="flex items-center gap-3">
          {TICKERS.map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-sm">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS[t] }} />
              <span className="font-medium">{COMPANY_NAMES[t]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPI_METRICS.map((metric) => {
          const vals = TICKERS.map((t) => {
            const item = data.find((d) => d.ticker === t)
            if (!item) return null
            const stmts = [item.income_stmt, item.balance_sheet, item.cash_flow]
            for (const stmt of stmts) {
              const latest = Object.entries(stmt).sort().pop()
              if (latest) {
                const v = latest[1][metric.key]
                if (v != null) return v
              }
            }
            return null
          })
          const maxVal = Math.max(...vals.filter((v): v is number => v != null), 0)
          return (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`card p-4 text-left transition-all ${
                selectedMetric === metric.key ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <p className="text-xs text-[var(--text-secondary)] mb-1">{metric.label}</p>
              {TICKERS.map((t, i) => {
                const v = vals[i]
                const pct = maxVal > 0 && v != null ? (v / maxVal) * 100 : 0
                return (
                  <div key={t} className="flex items-center gap-1.5 text-sm py-0.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[t] }} />
                    <span className="font-mono text-xs w-16 text-right">{v != null ? formatVal(v, metric.scale) : '-'}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{metric.unit}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--card-border)] ml-1">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[t] }} />
                    </div>
                  </div>
                )
              })}
            </button>
          )
        })}
      </div>

      {/* Interactive Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold text-[var(--text)]">{KPI_METRICS.find((m) => m.key === selectedMetric)?.label || selectedMetric}</h3>
            <p className="text-xs text-[var(--text-secondary)]">{selectedMetric}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="pill-group">
              <button className={`pill ${period === 'year' ? 'active' : ''}`} onClick={() => setPeriod('year')}>年</button>
              <button className={`pill ${period === 'quarter' ? 'active' : ''}`} onClick={() => setPeriod('quarter')}>季</button>
            </div>
            <div className="pill-group">
              <button className={`pill ${timeRange === '5y' ? 'active' : ''}`} onClick={() => setTimeRange('5y')}>近5年</button>
              <button className={`pill ${timeRange === '10y' ? 'active' : ''}`} onClick={() => setTimeRange('10y')}>近10年</button>
              <button className={`pill ${timeRange === 'all' ? 'active' : ''}`} onClick={() => setTimeRange('all')}>全部</button>
            </div>
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <Tooltip content={<CustomTooltip metric={selectedMetric} />} />
              <Legend />
              {TICKERS.map((t) => (
                <Line key={t} type="monotone" dataKey={t} stroke={COLORS[t]} strokeWidth={2} dot={{ r: 3 }} name={COMPANY_NAMES[t]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-16 text-center text-[var(--text-secondary)]">暫無此指標的歷史資料</div>
        )}

        {/* Growth Rate Row */}
        {(() => {
          const allVals = TICKERS.map((t) => {
            const series = chartData.map((d) => d[t] as number | null).filter((v): v is number => v != null)
            const last = series[series.length - 1] ?? null
            const prev = series[series.length - 2] ?? null
            return { ticker: t, last, yoy: yoy(last, prev), cagr5: cagr(series.slice(-5)), cagr10: cagr(series.slice(-10)) }
          })
          return (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left px-2 py-1.5 text-[var(--text-secondary)]">公司</th>
                    <th className="text-right px-2 py-1.5 text-[var(--text-secondary)]">最新值</th>
                    <th className="text-right px-2 py-1.5 text-[var(--text-secondary)]">YoY</th>
                    <th className="text-right px-2 py-1.5 text-[var(--text-secondary)]">近5年CAGR</th>
                    <th className="text-right px-2 py-1.5 text-[var(--text-secondary)]">近10年CAGR</th>
                  </tr>
                </thead>
                <tbody>
                  {allVals.map((v) => (
                    <tr key={v.ticker} className="border-b border-[var(--card-border)]">
                      <td className="px-2 py-1.5 font-medium" style={{ color: COLORS[v.ticker] }}>{COMPANY_NAMES[v.ticker]}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{formatVal(v.last, 1e6)}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${(v.yoy ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {v.yoy != null ? `${v.yoy >= 0 ? '+' : ''}${v.yoy.toFixed(1)}%` : '-'}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono ${(v.cagr5 ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {v.cagr5 != null ? `${v.cagr5 >= 0 ? '+' : ''}${v.cagr5.toFixed(1)}%` : '-'}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono ${(v.cagr10 ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {v.cagr10 != null ? `${v.cagr10 >= 0 ? '+' : ''}${v.cagr10.toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>

      {/* Rankings Table */}
      <div className="card overflow-hidden">
        <div className="card-header"><h3 className="font-semibold text-sm">指標排名</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                <th className="text-left px-3 py-2 text-[var(--text-secondary)]">指標</th>
                {TICKERS.map((t) => (
                  <th key={t} className="text-right px-3 py-2 text-[var(--text-secondary)]">{COMPANY_NAMES[t]}</th>
                ))}
                <th className="text-center px-3 py-2 text-[var(--text-secondary)]">排名</th>
              </tr>
            </thead>
            <tbody>
              {KPI_METRICS.map((m) => {
                const vals = TICKERS.map((t) => {
                  const item = data.find((d) => d.ticker === t)
                  if (!item) return null
                  for (const stmt of [item.income_stmt, item.balance_sheet, item.cash_flow]) {
                    const latest = Object.entries(stmt).sort().pop()
                    if (latest) {
                      const v = latest[1][m.key]
                      if (v != null) return v
                    }
                  }
                  return null
                })
                const sorted = TICKERS.map((t, i) => ({ ticker: t, val: vals[i] ?? -Infinity }))
                  .sort((a, b) => (b.val ?? 0) - (a.val ?? 0))
                return (
                  <tr key={m.key} className="border-b border-[var(--card-border)] hover:bg-[var(--sidebar-link-hover)]">
                    <td className="px-3 py-2 font-medium text-[var(--text)]">{m.label}</td>
                    {vals.map((v, i) => (
                      <td key={TICKERS[i]} className="px-3 py-2 text-right font-mono text-[var(--text)]">
                        {v != null ? formatVal(v, m.scale) : '-'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {sorted.map((s, rank) => (
                          <span key={s.ticker} className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center"
                            style={{
                              backgroundColor: rank === 0 ? '#fbbf24' : rank === 1 ? '#e5e7eb' : '#d97706',
                              color: rank === 2 ? 'white' : '#374151',
                            }}
                          >
                            {rank + 1}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-xl p-3 text-xs">
      <p className="font-semibold text-[var(--text)] mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 py-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[var(--text-secondary)]">{COMPANY_NAMES[p.name] || p.name}:</span>
          <span className="font-mono font-medium text-[var(--text)]">${(p.value / 1e6).toFixed(0)}M</span>
        </div>
      ))}
    </div>
  )
}
