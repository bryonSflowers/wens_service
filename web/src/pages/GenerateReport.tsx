import { useState } from 'react'
import { FileText, Send, Loader2, Copy, Check, Sparkles, Bot } from 'lucide-react'
import { useT } from '../i18n'
import { TickerDropdown } from '../components/ui/TickerDropdown'
import { ReportMarkdown } from '../components/ui/ReportMarkdown'
import client from '../api/client'

const SUGGESTIONS = [
  '分析最近一季的營收趨勢與月增率變化',
  'Compare revenue, EBITDA, and net income trends over the last 3 months',
  'What is the profit margin trend and what\'s driving it?',
  'Analyze the company\'s debt position and cash flow health',
  'Summarize the key risks and growth drivers',
]

export function GenerateReportPage() {
  const _ = useT()
  const [query, setQuery] = useState('')
  const [ticker, setTicker] = useState('3045.TW')
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async (q?: string) => {
    const text = q || query
    if (!text.trim()) return
    setLoading(true)
    setError('')
    setReport('')
    try {
      const { data } = await client.post('/reports/generate', {
        query: `Generate a detailed financial report for ${ticker}. ${text}\n\nUse specific data from the database. Structure with: Executive Summary, Key Metrics, Trend Analysis, Highlights & Concerns, Recommendations.`,
      })
      setReport(data.report || '')
      if (!data.report) setError('Empty response')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || 'Failed to generate'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{_('reports.generate')}</h1>
        <p className="page-subtitle">Use natural language to create financial reports via AI</p>
      </div>

      {/* Input area */}
      <div className="card p-5">
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="w-44">
              <label className="label text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Company</label>
              <TickerDropdown value={ticker} onChange={setTicker} />
            </div>
            <div className="flex-1">
              <label className="label text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Query</label>
              <input
                className="input w-full"
                placeholder='e.g. "Analyze Q1 2026 revenue trends"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleGenerate()}
                disabled={loading}
              />
            </div>
            <button className="btn-primary h-[38px]" onClick={() => handleGenerate()} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          {/* Suggested prompts */}
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="text-[11px] px-3 py-1.5 rounded-full border border-[var(--card-border)] hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[var(--text-secondary)] hover:text-blue-600 transition-colors flex items-center gap-1.5"
                onClick={() => { setQuery(s); handleGenerate(s) }} disabled={loading}>
                <Sparkles className="w-3 h-3" />
                {s.length > 35 ? s.slice(0, 35) + '...' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Report output */}
      {(report || loading) && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <FileText className="w-4 h-4 text-blue-500" />
                {loading && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping" />}
              </div>
              <span className="font-semibold text-sm">{ticker} Report</span>
              {loading && (
                <span className="flex items-center gap-1.5 text-[11px] text-blue-500 font-medium ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Generating
                </span>
              )}
            </div>
            {report && !loading && (
              <div className="flex gap-2">
                <button className="btn-secondary text-xs" onClick={handleCopy}>
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
          <div className="card-body max-h-[70vh] overflow-y-auto">
            {loading && !report && (
              <div className="flex flex-col items-center gap-3 py-16">
                <Bot className="w-12 h-12 text-blue-400 animate-pulse" />
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-sm text-[var(--text-secondary)] animate-pulse">Generating report...</p>
              </div>
            )}
            {report && <ReportMarkdown content={report} />}
          </div>
        </div>
      )}
    </div>
  )
}
