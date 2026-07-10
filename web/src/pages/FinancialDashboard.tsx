import { useEffect, useState } from 'react'
import { AlertTriangle, BarChart3 } from 'lucide-react'
import { TermTooltip } from '../components/ui/TermTooltip'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import client from '../api/client'
import { useT } from '../i18n'
import { PageLoading } from '../components/ui/Loading'
import { CompanyLegend } from '../components/ui/CompanyLegend'

const TICKERS = ['3045.TW', '2412.TW', '4904.TW']
const COLORS: Record<string, string> = { '3045.TW': '#F58220', '2412.TW': '#0096D6', '4904.TW': '#E5006D' }

const LABELS: Record<string, string> = {
  totalRevenue: 'Revenue', ebitda: 'EBITDA', operatingIncome: 'Operating Income',
  netIncome: 'Net Income', freeCashFlow: 'Free Cash Flow', capitalExpenditures: 'CapEx',
  totalAssets: 'Total Assets', totalDebt: 'Total Debt', totalCash: 'Cash',
  totalStockholderEquity: 'Equity', returnOnEquity: 'ROE', returnOnAssets: 'ROA',
  earningsPerShare: 'EPS', dividendYield: 'Dividend Yield', debtToEquity: 'D/E',
  currentRatio: 'Current Ratio', grossMargins: 'Gross Margin', operatingMargins: 'Operating Margin',
  profitMargins: 'Profit Margin', enterpriseToEbitda: 'EV/EBITDA',
}

const TERM_MAP: Record<string, string> = {
  totalRevenue: 'Revenue', ebitda: 'EBITDA', operatingIncome: 'Operating Income',
  netIncome: 'Net Income', freeCashFlow: 'Free Cash Flow', capitalExpenditures: 'CapEx',
  totalAssets: 'Total Assets', totalDebt: 'Total Debt', totalCash: 'Cash & Equivalents',
  totalStockholderEquity: 'Shareholders Equity', returnOnEquity: 'ROE', returnOnAssets: 'ROA',
  earningsPerShare: 'EPS', dividendYield: 'Dividend Yield', debtToEquity: 'Debt-to-Equity',
  currentRatio: 'Current Ratio', grossMargins: 'Gross Margin', operatingMargins: 'Operating Margin',
  profitMargins: 'Profit Margin', enterpriseToEbitda: 'EV/EBITDA',
}

const METRICS = Object.keys(LABELS)

function fmt(v: number, key: string): string {
  if (key === 'dividendYield' || key === 'grossMargins' || key === 'operatingMargins' || key === 'profitMargins') return `${(v * 100).toFixed(1)}%`
  if (key === 'returnOnEquity' || key === 'returnOnAssets') return `${(v * 100).toFixed(1)}%`
  if (key === 'earningsPerShare') return `NT$${v.toFixed(2)}`
  if (key === 'debtToEquity' || key === 'currentRatio') return v.toFixed(1)
  if (key === 'enterpriseToEbitda') return `${v.toFixed(1)}x`
  return `NT$${(v / 1e9).toFixed(1)}B`
}

export function FinancialDashboardPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState('totalRevenue')
  const [error, setError] = useState('')
  const _ = useT()

  useEffect(() => {
    client.get('/compare/financials', { params: { tickers: TICKERS.join(',') } })
      .then((r) => setData(r.data.items || []))
      .catch((e) => setError(e.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />
  if (error) return <div className="card p-6 text-red-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>
  if (!data.length) return <div className="card p-6 text-[var(--text-secondary)]">{_('fundash.noData')}</div>

  const barData = data.map((item) => ({
    ticker: item.ticker,
    value: item.metrics?.[selectedMetric] ?? 0,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{_('fundash.title')}</h1>
          <p className="page-subtitle">{_('fundash.subtitle')}</p>
        </div>
        <CompanyLegend tickers={TICKERS} />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {METRICS.map((key) => {
          const vals = TICKERS.map((t) => data.find((d) => d.ticker === t)?.metrics?.[key] ?? null)
          const maxVal = Math.max(...vals.filter((v): v is number => v != null), 0)
          return (
            <button key={key} onClick={() => setSelectedMetric(key)}
              className={`card p-3 text-left transition-all ${selectedMetric === key ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                <TermTooltip term={TERM_MAP[key] || LABELS[key]}>{LABELS[key]}</TermTooltip>
              </p>
              {TICKERS.map((t, i) => {
                const v = vals[i]
                const pct = maxVal > 0 && v != null ? (v / maxVal) * 100 : 0
                return (
                  <div key={t} className="flex items-center gap-1.5 text-xs py-0.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[t] }} />
                    <span className="font-mono text-[11px] text-right flex-1">{v != null ? fmt(v, key) : '-'}</span>
                    <div className="w-12 h-1.5 rounded-full bg-[var(--card-border)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[t] }} />
                    </div>
                  </div>
                )
              })}
            </button>
          )
        })}
      </div>

      {/* Bar chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">{LABELS[selectedMetric]}</h3>
            <p className="text-[10px] text-[var(--text-tertiary)]">{_('fundash.latestPeriod')}</p>
          </div>
        </div>
        {barData.some((d) => d.value > 0) ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={barData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="ticker" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: any) => [fmt(Number(value), selectedMetric), LABELS[selectedMetric]]} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                {barData.map((d) => (
                  <Cell key={d.ticker} fill={COLORS[d.ticker] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-16 text-center text-[var(--text-secondary)] text-sm">{_('fundash.selectMetric')}</div>
        )}
      </div>

      {/* Full data table */}
      <div className="card overflow-hidden">
        <div className="card-header"><h3 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" />{_('fundash.allMetrics')}</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
              <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">{_('fundash.metricLabel')}</th>
              {TICKERS.map((t) => (
                <th key={t} className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[t] }} />
                    {t}
                  </span>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {METRICS.map((key) => (
                <tr key={key} className="border-b border-[var(--card-border)] hover:bg-[var(--sidebar-link-hover)]">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">
                    <TermTooltip term={TERM_MAP[key] || LABELS[key]}>{LABELS[key]}</TermTooltip>
                  </td>
                  {TICKERS.map((t) => {
                    const v = data.find((d) => d.ticker === t)?.metrics?.[key] ?? null
                    return <td key={t} className="px-4 py-3 text-right font-mono text-[var(--text)]">{v != null ? fmt(v, key) : '-'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
