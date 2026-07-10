import { useState, useRef, useEffect } from 'react'
import {
  BarChart3, Activity, RefreshCw, AlertTriangle, GitCompare,
  TrendingUp, BarChart as BarIcon, BrainCircuit, Send,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import client from '../api/client'
import { CompanySelector, COMPANY_COLORS } from '../components/ui/CompanySelector'
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

export function ComparePage() {
  const [selected, setSelected] = useState<string[]>([])
  const [items, setItems] = useState<CompareItem[]>([])
  const [priceHistory, setPriceHistory] = useState<Record<string, { date: string; price: number }[]>>({})
  const [analysis, setAnalysis] = useState('')
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
        .then((r) => setAnalysis(r.data.analysis || ''))
        .catch(() => setAnalysis(''))
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

          {/* Valuation Table */}
          <div className="card overflow-hidden">
            <div className="card-header"><h3 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" />Valuation</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Metric</th>
                  {items.map((i) => <th key={i.ticker} className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">{i.ticker}</th>)}
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
                  {items.map((i) => <th key={i.ticker} className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">{i.ticker}</th>)}
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
              <div className="prose-report text-sm leading-relaxed whitespace-pre-wrap mb-6">{analysis}</div>
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
