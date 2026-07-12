import { useEffect, useState } from 'react'
import { generatedReportsApi } from '../api/client'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { Modal } from '../components/ui/Modal'
import { PageLoading } from '../components/ui/Loading'
import type { GeneratedReport } from '../types'
import { useT } from '../i18n'
import { ExternalLink, Trash2 } from 'lucide-react'
import { ReportMarkdown } from '../components/ui/ReportMarkdown'

export function GeneratedReportsPage() {
  const _ = useT()
  const [data, setData] = useState<GeneratedReport[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GeneratedReport | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetch = async (p: number) => {
    setLoading(true)
    try {
      const { data: res } = await generatedReportsApi.list({ page: p, page_size: 15 })
      setData(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
      setPage(res.page)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch(page) }, [page])

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await generatedReportsApi.delete(id)
      if (selected?.id === id) setSelected(null)
      fetch(page)
    } catch {}
    setDeleting(null)
  }

  const columns: Column<GeneratedReport>[] = [
    { key: 'id', header: 'ID', render: (r: GeneratedReport) => <span className="font-mono text-xs">#{r.id}</span> },
    { key: 'query', header: 'Query', render: (r: GeneratedReport) => (
      <span className="truncate block max-w-[400px]">{r.query}</span>
    )},
    { key: 'model', header: _('generated.model'), render: (r: GeneratedReport) => r.model || '-' },
    { key: 'tokens_used', header: _('generated.tokens'), render: (r: GeneratedReport) => r.tokens_used ?? '-' },
    { key: 'created_at', header: 'Date', render: (r: GeneratedReport) => new Date(r.created_at).toLocaleDateString() },
    { key: 'id2', header: '', render: () => <ExternalLink className="w-4 h-4 text-gray-400" />, className: 'w-10' },
    { key: 'delete', header: '', render: (r: GeneratedReport) => (
      <button
        onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
        disabled={deleting === r.id}
        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    ), className: 'w-10' },
  ]

  if (loading && !data.length) return <PageLoading />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{_('generated.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">History of LLM-generated financial reports</p>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          keyExtractor={(r) => r.id}
          onRowClick={setSelected}
        />
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)}
        title={
          <div className="flex items-center gap-3">
            <span>{_('generated.title')}</span>
            {selected && (
              <button onClick={() => handleDelete(selected.id)} disabled={deleting === selected.id}
                className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                {deleting === selected.id ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        }
        size="xl">
        {selected && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm text-gray-500">
              <span>{_('generated.model')}: {selected.model || 'N/A'}</span>
              <span>{_('generated.tokens')}: {selected.tokens_used ?? 'N/A'}</span>
              <span>Date: {new Date(selected.created_at).toLocaleString()}</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Query</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selected.query}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-1">Report</h4>
              <div className="bg-[var(--sidebar-hover)] rounded-lg p-4 max-h-[60vh] overflow-y-auto">
                <ReportMarkdown content={selected.report} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
