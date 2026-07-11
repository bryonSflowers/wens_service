import { useState } from 'react'
import {
  BarChart3, TrendingUp, TrendingDown, Activity, X, AlertTriangle, RefreshCw,
} from 'lucide-react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ZAxis, Legend,
} from 'recharts'
import client from '../api/client'
import { TickerDropdown } from '../components/ui/TickerDropdown'
import { COMPANY_COLORS } from '../components/ui/CompanySelector'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'

interface OptimizerPortfolio {
  weights: Record<string, number>
  annReturn: number
  annVol: number
  sharpe: number
}

interface FrontierPoint {
  ret: number
  vol: number
}

interface AssetStat {
  ticker: string
  annReturn: number
  annVol: number
  sharpe: number
}

interface OptimizerResponse {
  maxSharpe: OptimizerPortfolio
  minVariance: OptimizerPortfolio
  frontier: FrontierPoint[]
  assets: AssetStat[]
}

export function PortfolioOptimizerPage() {
  const [tickers, setTickers] = useState<string[]>([])
  const [inputTicker, setInputTicker] = useState('')
  const [years, setYears] = useState(3)
  const [result, setResult] = useState<OptimizerResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addTicker = (t: string) => {
    if (!t.trim() || tickers.includes(t) || tickers.length >= 10) return
    setTickers([...tickers, t])
    setInputTicker('')
  }

  const removeTicker = (t: string) => {
    setTickers(tickers.filter((x) => x !== t))
  }

  const optimize = async () => {
    if (tickers.length < 2) { setError('Select at least 2 tickers'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await client.get('/portfolio/optimize', {
        params: { tickers: tickers.join(','), years },
      })
      setResult(res.data)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Optimization failed')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Portfolio Optimizer</h1>
        <p className="page-subtitle">Build an optimal portfolio using Mean-Variance optimization</p>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex gap-2 items-end">
            <div className="w-44">
              <TickerDropdown value={inputTicker} onChange={(v) => { setInputTicker(v); addTicker(v) }} />
            </div>
            <div className="w-24">
              <label className="label">Years</label>
              <input className="input" type="number" min={1} max={10} value={years}
                onChange={(e) => setYears(parseInt(e.target.value) || 3)} />
            </div>
            <button className="btn-primary h-[38px]" onClick={optimize} disabled={loading || tickers.length < 2}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              Optimize
            </button>
            {error && <span className="text-sm text-red-500 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{error}</span>}
          </div>

          {tickers.length > 0 && (
            <div className="flex gap-2 flex-wrap items-center">
              {tickers.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                  bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMPANY_COLORS[t] || '#6b7280' }} />
                  {t}
                  <button onClick={() => removeTicker(t)} className="hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              <span className="text-xs text-[var(--text-secondary)]">{tickers.length}/10</span>
            </div>
          )}
        </div>
      </div>

      {loading && <PageLoading />}

      {result && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Max Sharpe Portfolio
                </h3>
                <div className="text-xs text-[var(--text-secondary)]">
                  Return: <span className="font-mono font-bold text-green-600">{result.maxSharpe.annReturn.toFixed(2)}%</span>
                  {' · '}Vol: <span className="font-mono font-bold">{result.maxSharpe.annVol.toFixed(2)}%</span>
                  {' · '}Sharpe: <span className="font-mono font-bold">{result.maxSharpe.sharpe.toFixed(2)}</span>
                </div>
              </div>
              <div className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                      <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Ticker</th>
                      <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.maxSharpe.weights).map(([ticker, weight]) => (
                      <tr key={ticker} className="border-b border-[var(--card-border)]">
                        <td className="px-4 py-3 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPANY_COLORS[ticker] || '#6b7280' }} />
                            {ticker}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{(weight * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-blue-500" />
                  Minimum Variance Portfolio
                </h3>
                <div className="text-xs text-[var(--text-secondary)]">
                  Return: <span className="font-mono font-bold">{result.minVariance.annReturn.toFixed(2)}%</span>
                  {' · '}Vol: <span className="font-mono font-bold text-green-600">{result.minVariance.annVol.toFixed(2)}%</span>
                  {' · '}Sharpe: <span className="font-mono font-bold">{result.minVariance.sharpe.toFixed(2)}</span>
                </div>
              </div>
              <div className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                      <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Ticker</th>
                      <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.minVariance.weights).map(([ticker, weight]) => (
                      <tr key={ticker} className="border-b border-[var(--card-border)]">
                        <td className="px-4 py-3 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPANY_COLORS[ticker] || '#6b7280' }} />
                            {ticker}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{(weight * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Efficient Frontier
              </h3>
              <span className="text-[10px] text-[var(--text-tertiary)]">X: Volatility · Y: Expected Return</span>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="x" type="number" domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  label={{ value: 'Volatility (%)', position: 'bottom', offset: 0, style: { fontSize: 10, fill: 'var(--text-tertiary)' } }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <YAxis dataKey="y" type="number" domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  label={{ value: 'Expected Return (%)', angle: -90, position: 'left', offset: 0, style: { fontSize: 10, fill: 'var(--text-tertiary)' } }}
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                <ZAxis range={[100, 100]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.[0]) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-xl p-3 text-xs">
                        <div className="space-y-1">
                          <p className="font-medium text-[var(--text)]">{d.name || 'Frontier Point'}</p>
                          <p>Return: <span className="font-mono">{d.y.toFixed(2)}%</span></p>
                          <p>Vol: <span className="font-mono">{d.x.toFixed(2)}%</span></p>
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend />
                <Scatter name="Efficient Frontier" data={result.frontier.map((p) => ({ x: p.vol, y: p.ret }))}
                  fill="#3b82f6" stroke="none" shape="circle" />
                <Scatter name="Max Sharpe" data={[{ x: result.maxSharpe.annVol, y: result.maxSharpe.annReturn, name: 'Max Sharpe' }]}
                  fill="#22c55e" stroke="#fff" strokeWidth={2} shape="diamond" />
                <Scatter name="Min Variance" data={[{ x: result.minVariance.annVol, y: result.minVariance.annReturn, name: 'Min Variance' }]}
                  fill="#f59e0b" stroke="#fff" strokeWidth={2} shape="triangle" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header"><h3 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" />Individual Asset Statistics</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Ticker</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Return</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Volatility</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Sharpe</th>
                  </tr>
                </thead>
                <tbody>
                  {result.assets.map((a) => (
                    <tr key={a.ticker} className="border-b border-[var(--card-border)]">
                      <td className="px-4 py-3 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPANY_COLORS[a.ticker] || '#6b7280' }} />
                          {a.ticker}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{a.annReturn.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{a.annVol.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{a.sharpe.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && !result && tickers.length === 0 && (
        <EmptyState title="Add tickers" description="Select 2–10 tickers and click Optimize to find the optimal portfolio." icon="chart" />
      )}
    </div>
  )
}
