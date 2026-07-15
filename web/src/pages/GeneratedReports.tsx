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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deletingMultiple, setDeletingMultiple] = useState(false)

  const fetch = async (p: number) => {
    setSelectedIds(new Set())
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

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.map(r => r.id)))
    }
  }

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await generatedReportsApi.delete(id)
      if (selected?.id === id) setSelected(null)
      fetch(page)
    } catch {}
    setDeleting(null)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    setDeletingMultiple(true)
    const ids = Array.from(selectedIds)
    try {
      await generatedReportsApi.batchDelete(ids)
      setSelectedIds(new Set())
      if (selected && ids.includes(selected.id)) setSelected(null)
      fetch(page)
    } catch {}
    setDeletingMultiple(false)
  }

  const allSelected = data.length > 0 && selectedIds.size === data.length

  const columns: Column<GeneratedReport>[] = [
    { key: 'select', header: (
      <input type="checkbox"
        checked={allSelected}
        onChange={toggleSelectAll}
        className="cursor-pointer" />
    ), render: (r: GeneratedReport) => (
      <input type="checkbox"
        checked={selectedIds.has(r.id)}
        onChange={() => toggleSelect(r.id)}
        onClick={(e) => e.stopPropagation()}
        className="cursor-pointer" />
    ), className: 'w-10' },
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
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--card-border)] bg-red-50/50 dark:bg-red-900/10">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleBatchDelete}
              disabled={deletingMultiple}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deletingMultiple ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
            </button>
          </div>
        )}
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
