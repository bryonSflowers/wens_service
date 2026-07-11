import { useState, useEffect, useRef } from 'react'
import { FileText, Send, Loader2, Copy, Check, Sparkles, Database, Brain, PenLine } from 'lucide-react'
import { useT } from '../i18n'
import { TickerDropdown } from '../components/ui/TickerDropdown'
import { ReportMarkdown } from '../components/ui/ReportMarkdown'
import { StructuredReport } from '../components/ui/StructuredReport'
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
  const [format, setFormat] = useState<'standard' | 'summary' | 'visual' | 'quant' | 'structured'>('standard')
  const [llmProvider, setLlmProvider] = useState<'deepseek' | 'claude'>('deepseek')
  const [structuredSections, setStructuredSections] = useState<any[] | null>(null)
  const [quantPrompt, setQuantPrompt] = useState('Use Monte Carlo simulation and Bayesian inference to analyze return distributions, tail risk, and probability of loss over multiple time horizons. Compute Value at Risk (VaR95/99), Conditional VaR, and stress test scenarios. Present results with confidence intervals and statistical significance levels.')
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressStep, setProgressStep] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const FORMAT_PROMPTS: Record<string, string> = {
    standard: 'Structure with: Executive Summary, Key Metrics, Trend Analysis, Highlights & Concerns, Recommendations. Use tables where helpful.',
    summary: 'Write an extremely concise summary under 4 paragraphs. Focus on the most important 3 numbers and what they mean. No tables. No fluff.',
    visual: 'Structure as a scannable visual report. DO NOT use code blocks or backticks anywhere. Use markdown headers (##, ###), bold (**text**), horizontal rules (---), bullet points, and proper markdown tables. Make sections clearly separated with headers and dividers. Emphasize key numbers with bold.',
    quant: 'Focus on key growth rates (MoM, YoY, CAGR) and statistical significance. Keep it concise — 1-2 sentences per metric with the most important numbers.',
  }

  const handleGenerate = async (q?: string) => {
    const text = q || query
    if (!text.trim()) return
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError('')
    setReport('')
    setStructuredSections(null)
    try {
      if (format === 'structured') {
        const { data } = await client.post('/reports/generate-structured', { query: `Generate a structured financial report for ${ticker}. ${text}\n\nUse specific data from the database.` }, { signal: controller.signal })
        if (data.sections?.length) setStructuredSections(data.sections); else setError('Empty response')
      } else {
        const quantExtra = format === 'quant' && quantPrompt.trim() ? `\n\nCustom quant instructions (user-specified): ${quantPrompt.trim()}` : ''
        const { data } = await client.post('/reports/generate', { query: `Generate a ${format} financial report for ${ticker}. ${text}\n\nUse specific data from the database. ${FORMAT_PROMPTS[format]}${quantExtra}`, provider: llmProvider }, { signal: controller.signal })
        setReport(data.report || '')
        if (!data.report) setError('Empty response')
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return
      const msg = err?.response?.data?.detail || err.message || 'Failed to generate'
      setError(msg)
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setLoading(false)
  }

  const PROGRESS_STEPS = [
    { icon: Database, label: 'Fetching market data...' },
    { icon: Brain, label: 'Analyzing financials...' },
    { icon: PenLine, label: 'Generating insights...' },
    { icon: Sparkles, label: 'Finalizing report...' },
  ]

  useEffect(() => {
    if (loading) {
      setProgressStep(0)
      progressTimer.current = setInterval(() => {
        setProgressStep((s) => (s < PROGRESS_STEPS.length - 1 ? s + 1 : s))
      }, 4000)
    } else {
      if (progressTimer.current) clearInterval(progressTimer.current)
    }
    return () => { if (progressTimer.current) clearInterval(progressTimer.current) }
  }, [loading])

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

          {/* Format selection */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Format:</span>
            <div className="flex gap-1">
              {(['standard', 'summary', 'visual', 'quant', 'structured'] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)} disabled={loading}
                  className={`text-[11px] px-3 py-1 rounded-full border transition-all capitalize ${
                    format === f
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:border-blue-300'
                  }`}
                >
                  {f === 'quant' ? 'Quant' : f}
                </button>
              ))}
            </div>
          </div>

          {/* LLM Provider selection */}
          {format !== 'structured' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Engine:</span>
              <div className="flex gap-1">
                {(['deepseek', 'claude'] as const).map((p) => (
                  <button key={p} onClick={() => setLlmProvider(p)} disabled={loading}
                    className={`text-[11px] px-3 py-1 rounded-full border transition-all ${
                      llmProvider === p
                        ? 'bg-purple-500 text-white border-purple-500'
                        : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:border-purple-300'
                    }`}
                  >
                    {p === 'deepseek' ? 'DeepSeek' : 'Claude'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Quant prompt — only shown for Quant format */}
          {format === 'quant' && (
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="label text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Custom Quant Instructions <span className="text-[var(--text-tertiary)] font-normal normal-case">(specify your preferred statistical methods)</span>
                </label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="e.g. Use GARCH for volatility, compute expected shortfall at 99%..."
                  value={quantPrompt}
                  onChange={(e) => setQuantPrompt(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (query.trim()) handleGenerate() } }}
                />
              </div>
              <button className="btn-primary h-[38px] shrink-0" onClick={() => query.trim() && handleGenerate()} disabled={loading || !query.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Quant
              </button>
            </div>
          )}

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
              <div className="flex flex-col items-center gap-6 py-12">
                {/* Progress step indicator */}
                <div className="w-full max-w-md space-y-4">
                  {PROGRESS_STEPS.map((step, i) => {
                    const Icon = step.icon
                    const isActive = i === progressStep
                    const isDone = i < progressStep
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                          isDone ? 'bg-green-500 text-white' :
                          isActive ? 'bg-blue-500 text-white scale-110' :
                          'bg-[var(--card-border)] text-[var(--text-tertiary)]'
                        }`}>
                          {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium transition-colors ${
                            isActive ? 'text-[var(--text)]' : isDone ? 'text-green-600 dark:text-green-400' : 'text-[var(--text-tertiary)]'
                          }`}>{step.label}</p>
                          {/* Progress bar for active step */}
                          {isActive && (
                            <div className="w-full h-1 rounded-full bg-[var(--card-border)] mt-1 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500 animate-progress" />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Stop button */}
                <button className="btn-danger text-sm flex items-center gap-2" onClick={handleStop}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Stop Generating
                </button>
              </div>
            )}
            {structuredSections && <StructuredReport sections={structuredSections} />}
            {report && <ReportMarkdown content={report} />}
          </div>
        </div>
      )}
    </div>
  )
}
