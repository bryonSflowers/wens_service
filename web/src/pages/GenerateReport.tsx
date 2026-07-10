import { useState } from 'react'
import { reportsApi } from '../api/client'
import { FileText, Send, Loader2 } from 'lucide-react'
import { useT } from '../i18n'

export function GenerateReportPage() {
  const _ = useT()
  const [query, setQuery] = useState('')
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{_('reports.generate')}</h1>
        <p className="text-sm text-gray-500 mt-1">Use natural language to create financial reports via LLM</p>
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
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {report && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="font-semibold">{_('generated.title')}</span>
            </div>
          </div>
          <div className="card-body">
            <div className="prose-report" dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }} />
          </div>
        </div>
      )}
    </div>
  )
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => match.startsWith('<ul>') ? match : `<ol>${match}</ol>`)

  const lines = html.split('\n').filter((l) => l.trim())
  html = lines
    .map((l) => {
      if (l.startsWith('<h') || l.startsWith('<ul') || l.startsWith('<ol') || l.startsWith('<li')) return l
      return `<p>${l}</p>`
    })
    .join('\n')

  return html
}
