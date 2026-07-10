import { useState, useRef, useEffect } from 'react'
import {
  BarChart3, Activity, RefreshCw, AlertTriangle, GitCompare,
  TrendingUp, BarChart as BarIcon, BrainCircuit, Send,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import client from '../api/client'
import { CompanySelector, COMPANY_COLORS } from '../components/ui/CompanySelector'
import { CompanyLegend } from '../components/ui/CompanyLegend'
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

interface AnalystConsensus {
  recommendation: string | null
  numAnalysts: number | null
  targetPrice: number | null
  currentPrice: number | null
  upside: number | null
}

interface FundamentalsBreakdown {
  piotroski: number | null
  piotroski_label: string
  piotroski_passed: string[]
  altman_z: number | null
  altman_zone: 'safe' | 'grey' | 'distress' | null
  peer_percentiles: Record<string, number>
}

export function ComparePage() {
  const [selected, setSelected] = useState<string[]>([])
  const [items, setItems] = useState<CompareItem[]>([])
  const [priceHistory, setPriceHistory] = useState<Record<string, { date: string; price: number }[]>>({})
  const [analysis, setAnalysis] = useState('')
  const [analysisScores, setAnalysisScores] = useState<Record<string, Record<string, number>> | null>(null)
  const [analysisVerdict, setAnalysisVerdict] = useState('')
  const [analysisSentiment, setAnalysisSentiment] = useState<Record<string, string>>({})
  const [analysisConsensus, setAnalysisConsensus] = useState<Record<string, AnalystConsensus>>({})
  const [analysisFundamentals, setAnalysisFundamentals] = useState<Record<string, FundamentalsBreakdown>>({})
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const compare = async () => {
    if (selected.length < 2) { setError('Select at least 2 companies'); return }
    setLoading(true); setError('')
    try {
      const [fullRes, ...histRes] = await Promise.all([
        client.get('/compare/full', { params: { tickers: selected.join(',') } }),
        ...selected.map((t) =>
          client.get(`/chart/${t}/ohlcv`, { params: { days: 365 } })
            .then((r) => ({ ticker: t, data: r.data.items || [] }))
            .catch(() => ({ ticker: t, data: [] }))
        ),
      ])
      setItems(fullRes.data.items || [])

      const history: Record<string, { date: string; price: number }[]> = {}
      for (const h of histRes) {
        if (h.data.length > 0) {
          history[h.ticker] = h.data.map((d: any) => ({
            date: (d.time || '').slice(0, 10),
            price: d.close,
          }))
        }
      }
      setPriceHistory(history)

      // Fetch LLM analysis in parallel
      setAnalysisLoading(true)
      setAnalysis('')
      client.get('/compare/analyze', { params: { tickers: selected.join(',') } })
        .then((r) => {
          setAnalysis(r.data.analysis || '')
          setAnalysisScores(r.data.scores || null)
          setAnalysisVerdict(r.data.verdict || '')
          setAnalysisSentiment(r.data.sentiment || {})
          setAnalysisConsensus(r.data.consensus || {})
          setAnalysisFundamentals(r.data.fundamentals_breakdown || {})
        })
        .catch(() => { setAnalysis(''); setAnalysisScores(null) })
        .finally(() => setAnalysisLoading(false))
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Comparison failed')
    }
    setLoading(false)
  }

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const val = (v: number | null | undefined, suffix = '', decimals = 2) =>
    v != null ? `${v.toFixed(decimals)}${suffix}` : '-'

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: 'user' as const, content: chatInput }
    setChatMessages((m) => [...m, userMsg])
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await client.post('/compare/chat', {
        tickers: selected,
        analysis,
        messages: [...chatMessages, userMsg],
      })
      setChatMessages((m) => [...m, { role: 'assistant', content: res.data.reply }])
    } catch {
      setChatMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I encountered an error.' }])
    }
    setChatLoading(false)
  }

  const pct = (v: number | null | undefined) =>
    v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '-'

  // Build chart data - normalized to 100
  const priceChartData: Record<string, any>[] = []
  const maxLen = Math.max(...Object.values(priceHistory).map((d) => d.length), 0)
  for (let i = 0; i < maxLen; i++) {
    const point: any = {}
    for (const [ticker, data] of Object.entries(priceHistory)) {
      if (i < data.length) {
        point[ticker] = data[i].price
        if (i === 0) point['date'] = data[i].date
      }
    }
    if (i > 0) {
      for (const ticker of Object.keys(priceHistory)) {
        if (priceHistory[ticker][i]) point['date'] = priceHistory[ticker][i].date
      }
    }
    priceChartData.push(point)
  }

  // Metrics bar chart data
  const metricLabels = ['P/E', 'P/B', 'ROE%', 'Div Yield%', 'EPS Growth%']
  const metricKeys = ['pe_ratio', 'pb_ratio', 'roe', 'dividend_yield', 'eps_growth_pct']
  const metricScale = [1, 1, 100, 100, 100]
  const metricsData = metricLabels.map((label, mi) => {
    const point: any = { metric: label }
    for (const item of items) {
      const raw = (item as any)[metricKeys[mi]]
      const scaled = raw != null ? raw * metricScale[mi] : null
      point[item.ticker] = scaled
    }
    return point
  })

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
          {/* Price Performance Chart */}
          {priceChartData.length > 1 && (
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-4 h-4 text-[var(--text-secondary)]" />
                <h3 className="text-sm font-semibold text-[var(--text)]">Price Performance (1Y)</h3>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={priceChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  {items.map((item) => (
                    <Line
                      key={item.ticker}
                      type="monotone"
                      dataKey={item.ticker}
                      stroke={COMPANY_COLORS[item.ticker] || '#3b82f6'}
                      strokeWidth={2}
                      dot={false}
                      name={item.ticker}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Metrics Bar Chart */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarIcon className="w-4 h-4 text-[var(--text-secondary)]" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Key Metrics Comparison</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                <Tooltip />
                <Legend />
                {items.map((item) => (
                  <Bar
                    key={item.ticker}
                    dataKey={item.ticker}
                    fill={COMPANY_COLORS[item.ticker] || '#3b82f6'}
                    name={item.ticker}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cartesian Scatter Plot — Valuation vs Growth */}
          {items.length >= 2 && (() => {
            const scatterData = items.map((i) => ({
              x: i.pe_ratio ?? 0,
              y: i.eps_growth_pct != null ? i.eps_growth_pct * 100 : 0,
              z: i.market_cap ?? 0,
              ticker: i.ticker,
              label: `${i.ticker}\nP/E: ${i.pe_ratio?.toFixed(1)}x\nEPS Growth: ${i.eps_growth_pct != null ? (i.eps_growth_pct * 100).toFixed(1) : '-'}%`,
            }))
            const xDomain = [Math.min(...scatterData.map(d => d.x)) * 0.85, Math.max(...scatterData.map(d => d.x)) * 1.15]
            const yDomain = [Math.min(...scatterData.map(d => d.y)) * 0.85 || -5, Math.max(...scatterData.map(d => d.y)) * 1.15 || 20]
            return (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[var(--text)]">Valuation vs Growth — Cartesian Plot</h3>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Bubble size = Market Cap · X: P/E (cheaper →) · Y: EPS Growth %</span>
                </div>
                <ResponsiveContainer width="100%" height={360}>
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="x" type="number" domain={xDomain} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      label={{ value: 'P/E Ratio (x)', position: 'bottom', offset: 0, style: { fontSize: 10, fill: 'var(--text-tertiary)' } }} />
                    <YAxis dataKey="y" type="number" domain={yDomain} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      label={{ value: 'EPS Growth (%)', angle: -90, position: 'left', offset: 0, style: { fontSize: 10, fill: 'var(--text-tertiary)' } }} />
                    <ZAxis dataKey="z" range={[400, 2000]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value: any) => [value]}
                      labelFormatter={() => ''}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.[0]) return null
                        const d = payload[0].payload
                        return (
                          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-xl p-3 text-xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COMPANY_COLORS[d.ticker] }} />
                              <span className="font-bold text-[var(--text)]">{d.ticker}</span>
                            </div>
                            <div className="space-y-1 text-[var(--text-secondary)]">
                              <p>P/E: <span className="font-mono text-[var(--text)]">{d.x.toFixed(1)}x</span></p>
                              <p>EPS Growth: <span className="font-mono text-[var(--text)]">{d.y.toFixed(1)}%</span></p>
                              <p>Market Cap: <span className="font-mono text-[var(--text)]">${(d.z / 1e9).toFixed(1)}B</span></p>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Legend formatter={(value: string) => <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{value}</span>} />
                    {/* Quadrant labels */}
                    <text x="15%" y="8%" fontSize={9} fill="var(--text-tertiary)" dominantBaseline="middle" textAnchor="middle">Cheap · High Growth</text>
                    <text x="85%" y="8%" fontSize={9} fill="var(--text-tertiary)" dominantBaseline="middle" textAnchor="middle">Expensive · High Growth</text>
                    <text x="15%" y="92%" fontSize={9} fill="var(--text-tertiary)" dominantBaseline="middle" textAnchor="middle">Cheap · Low Growth</text>
                    <text x="85%" y="92%" fontSize={9} fill="var(--text-tertiary)" dominantBaseline="middle" textAnchor="middle">Expensive · Low Growth</text>
                    {scatterData.map((d) => (
                      <Scatter key={d.ticker} name={d.ticker} data={[d]} fill={COMPANY_COLORS[d.ticker] || '#3b82f6'} stroke="#fff" strokeWidth={1.5} />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )
          })()}

          {/* Valuation Table */}
          <div className="card overflow-hidden">
            <div className="card-header"><h3 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" />Valuation</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Metric</th>
                  {items.map((i) => (
                    <th key={i.ticker} className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COMPANY_COLORS[i.ticker] || '#6b7280' }} />
                        {i.ticker}
                      </span>
                    </th>
                  ))}
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

          {/* Performance Table */}
          <div className="card overflow-hidden">
            <div className="card-header"><h3 className="font-semibold text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Performance & Risk (1Y)</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Metric</th>
                  {items.map((i) => (
                    <th key={i.ticker} className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COMPANY_COLORS[i.ticker] || '#6b7280' }} />
                        {i.ticker}
                      </span>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {[
                    ['Current Price', (i: CompareItem) => val(i.performance?.current_price)],
                    ['1Y Return', (i: CompareItem) => <span className={i.performance?.price_change_1y_pct != null && i.performance.price_change_1y_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>{pct(i.performance?.price_change_1y_pct)}</span>],
                    ['Volatility', (i: CompareItem) => val(i.performance?.volatility_pct, '%')],
                    ['Sharpe Ratio', (i: CompareItem) => val(i.performance?.sharpe)],
                    ['Max Drawdown', (i: CompareItem) => <span className="text-red-500 dark:text-red-400">{val(i.performance?.max_drawdown_pct, '%')}</span>],
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

      {/* AI Scorecard — interactive charts from analysis */}
      {(analysisScores || items.length > 0) && (
        <div className="space-y-6">
          {/* HEADER ROW */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text)]">
              {analysisScores ? 'AI Analyst Scorecard' : 'Comparative Scorecard'}
            </h3>
            {analysisVerdict && (
              <div className="text-xs text-[var(--text-secondary)] px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
                {analysisVerdict.length > 80 ? analysisVerdict.slice(0, 80) + '...' : analysisVerdict}
              </div>
            )}
          </div>

          {/* TOP ROW: Radar + Rank */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Radar chart - takes 2 cols */}
            <div className="lg:col-span-2 card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Multi-Dimension Comparison</span>
                <div className="flex items-center gap-3">
                  <CompanyLegend tickers={analysisScores ? Object.keys(analysisScores) : items.map(i => i.ticker)} />
                  <span className="text-[10px] text-[var(--text-tertiary)]">0 = weak · 50 = avg · 100 = strong</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={
                  analysisScores && Object.keys(analysisScores).length > 0
                    ? ['valuation','profitability','growth','health','momentum'].map((dim) => {
                        const labels: Record<string,string> = { valuation:'Valuation', profitability:'Profitability', growth:'Growth', health:'Health', momentum:'Momentum' }
                        const p: any = { dim: labels[dim] || dim }
                        for (const [t, s] of Object.entries(analysisScores)) { p[t] = (s as any)[dim] || 0 }
                        return p
                      })
                    : (() => {
                        const dims = ['pe_ratio','roe','eps_growth_pct','dividend_yield','market_cap']
                        const dl = ['Value','Profit','Growth','Yield','Size']
                        const sc = [1,100,100,100,1e9]; const ih = [false,true,true,true,true]
                        const mv: Record<string,number> = {}
                        for (const d of dims) mv[d] = Math.max(...items.map(i => Math.abs((i as any)[d] ?? 0)),0)
                        return dl.map((l,di) => {
                          const p: any = { dim: l }
                          for (const item of items) {
                            const raw = (item as any)[dims[di]]
                            const scaled = raw != null ? raw * sc[di] : 0
                            p[item.ticker] = mv[dims[di]] > 0 ? (ih[di] ? scaled/mv[dims[di]] : 1 - scaled/mv[dims[di]]) * 100 : 0
                          }
                          return p
                        })
                      })()
                }>
                  <PolarGrid gridType="circle" stroke="var(--card-border)" />
                  <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: 'var(--text-tertiary)' }} tickCount={5} />
                  {(analysisScores ? Object.keys(analysisScores) : items.map(i => i.ticker)).map((t) => (
                    <Radar key={t} name={t} dataKey={t}
                      stroke={COMPANY_COLORS[t] || '#3b82f6'}
                      fill={COMPANY_COLORS[t] || '#3b82f6'} fillOpacity={0.06} strokeWidth={2.5} activeDot={{ r: 4 }} />
                  ))}
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: any) => [`${Math.round(Number(value) || 0)}/100`, 'Score']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Verdict + key insight */}
            <div className="card p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">AI Verdict</span>
                {analysisVerdict ? (
                  <p className="text-sm leading-relaxed text-[var(--text)] mt-2">{analysisVerdict}</p>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] mt-2 italic">Analysis complete. Scroll down for full breakdown or ask a question in the chat below.</p>
                )}
              </div>
              {analysisScores && (
                <div className="mt-4 space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Overall Ranking</span>
                  {Object.entries(analysisScores)
                    .sort(([,a]: any, [,b]: any) => {
                      const avgA = (a.valuation + a.profitability + a.growth + a.health + a.momentum) / 5
                      const avgB = (b.valuation + b.profitability + b.growth + b.health + b.momentum) / 5
                      return avgB - avgA
                    })
                    .map(([ticker, scores]: any, idx) => {
                      const avg = Math.round((scores.valuation + scores.profitability + scores.growth + scores.health + scores.momentum) / 5)
                      return (
                        <div key={ticker} className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-gray-300 text-gray-700' : 'bg-orange-400 text-white'
                          }`}>{idx + 1}</span>
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COMPANY_COLORS[ticker] }} />
                          <span className="text-xs font-medium text-[var(--text)] flex-1">{ticker}</span>
                          <span className="text-xs font-mono font-bold text-[var(--text)]">{avg}</span>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>

          {/* GROUPED BAR: Scorecard dimension scores — grouped by dimension, one bar per company */}
          {analysisScores && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Scorecard by Dimension</span>
                <span className="text-[10px] text-[var(--text-tertiary)]">Per-dimension score (0–100), grouped for direct comparison</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={['valuation','profitability','growth','health','momentum'].map((dim) => {
                    const labels: Record<string, string> = { valuation:'Valuation', profitability:'Profitability', growth:'Growth', health:'Health', momentum:'Momentum' }
                    const p: any = { dim: labels[dim] || dim }
                    for (const [t, s] of Object.entries(analysisScores)) { p[t] = (s as any)[dim] ?? 0 }
                    return p
                  })}
                  margin={{ top: 5, right: 20, bottom: 5, left: 5 }}
                  barCategoryGap="20%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                  <XAxis dataKey="dim" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={25} ticks={[0, 25, 50, 75, 100]} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-xl p-2.5 text-xs">
                          <p className="font-semibold text-[var(--text)] mb-1.5">{label}</p>
                          {payload.map((p: any) => (
                            <div key={p.name} className="flex items-center gap-2 py-0.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                              <span className="text-[var(--text-secondary)]">{p.name}:</span>
                              <span className="font-mono font-bold text-[var(--text)]">{Math.round(p.value as number)}/100</span>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {Object.keys(analysisScores).map((t) => (
                    <Bar key={t} dataKey={t} name={t}
                      fill={COMPANY_COLORS[t] || '#3b82f6'}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={40}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ANALYST CONSENSUS + FUNDAMENTALS QUALITY */}
          {(Object.keys(analysisConsensus).length > 0 || Object.keys(analysisFundamentals).length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Analyst consensus */}
              {Object.keys(analysisConsensus).length > 0 && (
                <div className="card p-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block mb-3">Analyst Consensus</span>
                  <div className="space-y-3">
                    {Object.entries(analysisConsensus).map(([ticker, cons]) => {
                      const recColor = cons.recommendation?.includes('BUY')
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : cons.recommendation?.includes('SELL')
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      const upsideColor = cons.upside != null && cons.upside > 0
                        ? 'text-green-600 dark:text-green-400'
                        : cons.upside != null && cons.upside < 0
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-[var(--text-secondary)]'
                      return (
                        <div key={ticker} className="flex items-center gap-3 py-2 border-b border-[var(--card-border)] last:border-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COMPANY_COLORS[ticker] }} />
                          <span className="text-xs font-bold text-[var(--text)] w-20 shrink-0">{ticker}</span>
                          {cons.recommendation ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${recColor}`}>{cons.recommendation}</span>
                          ) : <span className="text-[10px] text-[var(--text-tertiary)]">No consensus</span>}
                          {cons.numAnalysts && <span className="text-[10px] text-[var(--text-tertiary)]">{cons.numAnalysts} analysts</span>}
                          <span className="flex-1" />
                          {cons.targetPrice && (
                            <span className="text-xs text-[var(--text-secondary)]">
                              Target <span className="font-mono font-bold text-[var(--text)]">${cons.targetPrice}</span>
                            </span>
                          )}
                          {cons.upside != null && (
                            <span className={`text-xs font-mono font-bold ${upsideColor}`}>
                              {cons.upside >= 0 ? '+' : ''}{cons.upside}%
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Piotroski F-Score + Altman Z-Score */}
              {Object.keys(analysisFundamentals).length > 0 && (
                <div className="card p-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block mb-3">Fundamental Quality Scores</span>
                  <div className="space-y-3">
                    {Object.entries(analysisFundamentals).map(([ticker, fb]) => {
                      const pColor = fb.piotroski != null && fb.piotroski >= 7
                        ? 'text-green-600 dark:text-green-400'
                        : fb.piotroski != null && fb.piotroski >= 4
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-500 dark:text-red-400'
                      const zColor = fb.altman_zone === 'safe'
                        ? 'text-green-600 dark:text-green-400'
                        : fb.altman_zone === 'grey'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-500 dark:text-red-400'
                      return (
                        <div key={ticker} className="py-2 border-b border-[var(--card-border)] last:border-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COMPANY_COLORS[ticker] }} />
                            <span className="text-xs font-bold text-[var(--text)]">{ticker}</span>
                          </div>
                          <div className="flex gap-4 ml-4.5">
                            <div>
                              <p className="text-[10px] text-[var(--text-tertiary)]">Piotroski F-Score</p>
                              <p className={`text-sm font-bold font-mono ${pColor}`}>
                                {fb.piotroski ?? '-'}/9
                                <span className="text-[10px] font-normal ml-1">{fb.piotroski_label}</span>
                              </p>
                            </div>
                            {fb.altman_z != null && (
                              <div>
                                <p className="text-[10px] text-[var(--text-tertiary)]">Altman Z-Score</p>
                                <p className={`text-sm font-bold font-mono ${zColor}`}>
                                  {fb.altman_z}
                                  <span className="text-[10px] font-normal ml-1 capitalize">{fb.altman_zone}</span>
                                </p>
                              </div>
                            )}
                          </div>
                          {fb.piotroski_passed?.length > 0 && (
                            <p className="text-[10px] text-[var(--text-tertiary)] ml-4.5 mt-1">
                              ✓ {fb.piotroski_passed.slice(0, 3).join(' · ')}{fb.piotroski_passed.length > 3 ? ` +${fb.piotroski_passed.length - 3} more` : ''}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOTTOM ROW: Per-company detailed scorecards */}
          {analysisScores && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(analysisScores).map(([ticker, scores]: any) => {
                const dimEntries = [
                  { key: 'valuation', label: 'Valuation', desc: 'Price relative to earnings, book value, and cash flow' },
                  { key: 'profitability', label: 'Profitability', desc: 'Margins, ROE, and return on capital efficiency' },
                  { key: 'growth', label: 'Growth', desc: 'Revenue and earnings momentum' },
                  { key: 'health', label: 'Health', desc: 'Balance sheet strength and dividend sustainability' },
                  { key: 'momentum', label: 'Momentum', desc: 'Price trend, technical setup, and volume conviction' },
                ]
                const overall = Math.round((scores.valuation + scores.profitability + scores.growth + scores.health + scores.momentum) / 5)
                const sent = analysisSentiment[ticker]
                return (
                  <div key={ticker} className="card p-4">
                    {/* Company header */}
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[var(--card-border)]">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COMPANY_COLORS[ticker] }} />
                      <span className="text-sm font-bold text-[var(--text)]">{ticker}</span>
                      {sent && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sent === 'bullish' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          sent === 'bearish' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>{sent}</span>
                      )}
                      {analysisConsensus[ticker]?.upside != null && (
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          (analysisConsensus[ticker].upside ?? 0) > 0
                            ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {(analysisConsensus[ticker].upside ?? 0) >= 0 ? '+' : ''}{analysisConsensus[ticker].upside}%
                        </span>
                      )}
                      <span className="ml-auto text-lg font-bold font-mono">{overall}</span>
                    </div>
                    {/* Dimension gauges */}
                    <div className="space-y-3">
                      {dimEntries.map(({ key, label, desc }) => {
                        const val = scores[key] ?? 0
                        const rating = val >= 70 ? 'Strong' : val >= 45 ? 'Average' : 'Weak'
                        return (
                          <div key={key}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-[var(--text)]">{label}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                  val >= 70 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                                  val >= 45 ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                  'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                }`}>{rating}</span>
                              </div>
                              <span className="text-xs font-mono font-bold" style={{ color: COMPANY_COLORS[ticker] }}>{Math.round(val)}</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-[var(--card-border)] overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${val}%`, backgroundColor: COMPANY_COLORS[ticker] }} />
                            </div>
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{desc}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {selected.length >= 2 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-purple-500" />
              AI Analyst Comparison
              {!analysisLoading && !analysis && <span className="text-xs font-normal text-[var(--text-secondary)] ml-2">Click Compare to auto-generate analysis, or ask a question below</span>}
            </h3>
          </div>
          <div className="card-body">
            {/* Analysis section */}
            {analysisLoading && (
              <div className="space-y-3 mb-6">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-5/6" />
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            )}
            {analysis && (
              <div className="mb-6 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Full Analysis — tap to expand sections</h4>
                  <button
                    className="text-[10px] text-blue-500 hover:text-blue-600"
                    onClick={() => {
                      const all = document.querySelectorAll('[data-section-content]')
                      const allVisible = Array.from(all).every(el => el.classList.contains('hidden'))
                      all.forEach(el => el.classList.toggle('hidden', !allVisible))
                    }}
                  >
                    Toggle all
                  </button>
                </div>
                {analysis.split(/(?=## )/).filter(Boolean).map((section, si) => {
                  const lines = section.trim().split('\n').filter(Boolean)
                  const heading = lines[0]?.replace(/^##\s*#?\s*/, '').replace(/\*\*/g, '').trim() || 'Section'
                  const body = lines.slice(1).join('\n').trim()
                  const hasWarning = body.includes('⚠️')
                  const hasCheck = body.includes('✅')
                  // Extract first few key numbers for summary pills
                  const numbers = body.match(/\d+\.?\d*%/g)?.slice(0, 3) || []
                  return (
                    <details key={si} className="card overflow-hidden group open:ring-1 open:ring-blue-200 dark:open:ring-blue-800 transition-all">
                      <summary className="p-3 cursor-pointer hover:bg-[var(--sidebar-link-hover)] transition-colors flex items-center gap-3 text-sm font-medium text-[var(--text)] list-none [&::-webkit-details-marker]:hidden">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          hasWarning ? 'bg-red-400' : hasCheck ? 'bg-green-400' : 'bg-slate-300'
                        }`} />
                        <span className="flex-1">{heading}</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
                          {hasCheck && <span className="text-green-500">✓</span>}
                          {hasWarning && <span className="text-red-400">⚠</span>}
                          {numbers.slice(0, 2).map((n, ni) => (
                            <span key={ni} className="font-mono bg-[var(--card-border)] px-1.5 py-0.5 rounded text-[10px]">{n}</span>
                          ))}
                        </span>
                        <svg className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform group-open:rotate-180 shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-3 pb-3 border-t border-[var(--card-border)] pt-2">
                        <div className="prose-report text-xs leading-relaxed whitespace-pre-wrap text-[var(--text)]">{body || section}</div>
                      </div>
                    </details>
                  )
                })}
              </div>
            )}

            {/* Chat section — always visible */}
            <div className={analysis ? 'border-t border-[var(--card-border)] pt-4' : ''}>
              <div className="flex items-center gap-2 mb-3">
                <BrainCircuit className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-semibold text-[var(--text)]">
                  {analysis ? 'Ask Follow-up Questions' : `Ask about ${selected.map(t => t.replace('.TW','')).join(', ')}`}
                </span>
              </div>

              {/* Chat messages */}
              <div className="space-y-3 max-h-80 overflow-y-auto mb-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-[var(--sidebar-link-hover)] text-[var(--text)] rounded-bl-md'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2">
                  <div className="max-w-[80%] rounded-xl rounded-bl-md px-4 py-2.5 text-sm bg-[var(--sidebar-link-hover)]">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatRef} />
              </div>

              {/* Chat input */}
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Ask about these companies..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                  disabled={chatLoading}
                />
                <button className="btn-primary" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
