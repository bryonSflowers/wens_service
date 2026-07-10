import { useState } from 'react'
import { reportsApi } from '../api/client'
import { FileText, Send, Loader2, Copy, Printer, Check } from 'lucide-react'
import { useT } from '../i18n'
import { ReportMarkdown } from '../components/ui/ReportMarkdown'

export function GenerateReportPage() {
  const _ = useT()
  const [query, setQuery] = useState('')
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setReport('')
    try {
      const { data } = await reportsApi.generate({ query })
      setReport(data.report)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to generate report'
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
        <h1 className="text-2xl font-bold">{_('reports.generate')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Use natural language to create financial reports via LLM</p>
      </div>

      <div className="card p-6">
        <div className="flex gap-3">
          <input
            className="input flex-1"
            placeholder='e.g. "Analyze Q1 2026 revenue trends and compare month over month"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            disabled={loading}
          />
          <button className="btn-primary" onClick={handleGenerate} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Generating...' : _('reports.generate')}
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {report && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <span className="font-semibold text-sm">{_('generated.title')}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={handleCopy}>
                {copied
                  ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</>
                  : <><Copy className="w-3.5 h-3.5" /> Copy</>
                }
              </button>
              <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
          <div className="card-body">
            <ReportMarkdown content={report} />
          </div>
        </div>
      )}
    </div>
  )
}
