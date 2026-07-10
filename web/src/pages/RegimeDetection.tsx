import { useState } from 'react'
import {
  Activity, Shield, AlertTriangle, Search, RefreshCw,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import client from '../api/client'
import { TickerDropdown } from '../components/ui/TickerDropdown'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'

interface RegimeInfo {
  state: number
  label: string
  count: number
  mean_return: number
  volatility: number
  var_95: number
  var_99: number
}

interface TimelinePoint {
  date: string
  state: number
}

interface RegimeResponse {
  current_regime: {
    state: number
    label: string
    volatility: number
  }
  regimes: RegimeInfo[]
  timeline: TimelinePoint[]
  transition_matrix: number[][]
  current_var_95: number
  overall_var_95: number
  current_var_99: number
  overall_var_99: number
}

const REGIME_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#ec4899']

const REGIME_LABELS: Record<number, string> = {
  0: 'Bull (Low Vol)',
  1: 'Normal',
  2: 'Bear (High Vol)',
}

export function RegimeDetectionPage() {
  const [ticker, setTicker] = useState('3045.TW')
  const [nStates, setNStates] = useState(3)
  const [result, setResult] = useState<RegimeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const detect = async () => {
    if (!ticker.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await client.get(`/risk/${ticker}/regimes`, {
        params: { n_states: nStates },
      })
      setResult(res.data)
    } catch (e: any) {
      setError(e.response?.data?.detail || `Could not detect regimes for ${ticker}.`)
    }
    setLoading(false)
  }

  const regimeLabel = (state: number) => REGIME_LABELS[state] || `State ${state}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Regime Detection</h1>
        <p className="page-subtitle">Markov switching model to identify market regimes</p>
      </div>

      <div className="card">
        <div className="card-body flex gap-2 items-end">
          <div className="w-44">
            <TickerDropdown value={ticker} onChange={(v) => { setTicker(v); setTimeout(() => detect(), 100) }} />
          </div>
          <div className="w-24">
            <label className="label">States</label>
            <input className="input" type="number" min={2} max={5} value={nStates}
              onChange={(e) => setNStates(parseInt(e.target.value) || 3)} />
          </div>
          <button className="btn-primary h-[38px]" onClick={detect} disabled={loading || !ticker.trim()}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Detect Regimes
          </button>
          {error && <span className="text-sm text-red-500 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{error}</span>}
        </div>
      </div>

      {loading && <PageLoading />}

      {result && (
        <>
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
                style={{ backgroundColor: REGIME_COLORS[result.current_regime.state] || '#6b7280' }}>
                {result.current_regime.state + 1}
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Current Regime</p>
                <h2 className="text-xl font-bold text-[var(--text)]">{result.current_regime.label}</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Volatility: <span className="font-mono font-bold">{(result.current_regime.volatility * 100).toFixed(2)}%</span>
                </p>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header"><h3 className="font-semibold text-sm flex items-center gap-2"><Shield className="w-4 h-4" />Regime Comparison</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Regime</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Count</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Mean Return</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Volatility</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">VaR95</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">VaR99</th>
                  </tr>
                </thead>
                <tbody>
                  {result.regimes.map((r) => (
                    <tr key={r.state} className="border-b border-[var(--card-border)]">
                      <td className="px-4 py-3 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: REGIME_COLORS[r.state] || '#6b7280' }} />
                          {r.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{r.count}</td>
                      <td className="px-4 py-3 text-right font-mono">{(r.mean_return * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{(r.volatility * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{(r.var_95 * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{(r.var_99 * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-4 h-4 text-[var(--text-secondary)]" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Regime Timeline</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={result.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} interval="preserveStartEnd" />
                <YAxis domain={[-0.5, nStates - 0.5]} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  ticks={Array.from({ length: nStates }, (_, i) => i)}
                  tickFormatter={(v: number) => regimeLabel(v)} />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.[0]) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-xl p-3 text-xs">
                        <p className="font-medium text-[var(--text)]">{d.date}</p>
                        <p>State: <span className="font-mono font-bold">{d.state}</span></p>
                        <p>Regime: <span className="font-mono" style={{ color: REGIME_COLORS[d.state] }}>{regimeLabel(d.state)}</span></p>
                      </div>
                    )
                  }}
                />
                <defs>
                  <linearGradient id="regimeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="stepAfter" dataKey="state" stroke="#3b82f6" fill="url(#regimeFill)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header"><h3 className="font-semibold text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Transition Matrix</h3></div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm max-w-md mx-auto">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">From \ To</th>
                    {result.regimes.map((r) => (
                      <th key={r.state} className="px-4 py-2 text-right font-medium text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1 justify-end">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: REGIME_COLORS[r.state] }} />
                          {r.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.transition_matrix.map((row, si) => (
                    <tr key={si} className="border-b border-[var(--card-border)]">
                      <td className="px-4 py-3 font-medium">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REGIME_COLORS[si] }} />
                          {result.regimes[si]?.label || `State ${si}`}
                        </span>
                      </td>
                      {row.map((prob, sj) => {
                        const highProb = prob > 0.5
                        return (
                          <td key={sj} className={`px-4 py-3 text-right font-mono ${highProb ? 'font-bold' : ''}`}
                            style={{ color: highProb ? REGIME_COLORS[sj] : undefined }}>
                            {(prob * 100).toFixed(0)}%
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Value at Risk: Current Regime vs Overall
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <p className="text-xs text-[var(--text-secondary)] mb-2">Current Regime</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">{(result.current_var_95 * 100).toFixed(2)}%</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">VaR 95%</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono text-red-500">{(result.current_var_99 * 100).toFixed(2)}%</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">VaR 99%</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/20 rounded-lg p-4 text-center">
                <p className="text-xs text-[var(--text-secondary)] mb-2">Overall (All Regimes)</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">{(result.overall_var_95 * 100).toFixed(2)}%</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">VaR 95%</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono text-red-500">{(result.overall_var_99 * 100).toFixed(2)}%</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">VaR 99%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !result && !error && (
        <EmptyState title="Select a ticker" description="Choose a ticker and click Detect Regimes to analyze regime patterns." icon="chart" />
      )}
    </div>
  )
}
